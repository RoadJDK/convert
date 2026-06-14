import { describe, expect, it, vi } from "vitest";

const jsquashMock = vi.hoisted(() => ({
  encodeAvifWasm: vi.fn(async () => new Uint8Array([4, 5, 6]).buffer),
  encodeWebpWasm: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  optimisePngWasm: vi.fn(async (buffer: ArrayBuffer) => buffer),
}));

vi.mock("@/lib/jsquash", () => jsquashMock);

import {
  canvasToBlobWithFormat,
  cleanLowAlphaPixels,
  compressLossyToMaxSize,
  createEncodingCanvas,
  getImageCodecAdapter,
  refineBackgroundRemovalAlpha,
} from "@/lib/imageEncoding";

describe("image encoding", () => {
  it("routes formats through explicit codec adapters", () => {
    expect(getImageCodecAdapter("webp").id).toBe("jsquash-webp");
    expect(getImageCodecAdapter("avif").id).toBe("jsquash-avif");
    expect(getImageCodecAdapter("png").id).toBe("jsquash-png");
    expect(getImageCodecAdapter("jpeg").id).toBe("browser-canvas");
  });

  it("prefers OffscreenCanvas for worker-capable rendering and falls back to DOM canvas", () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;

    class FakeOffscreenCanvas {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(),
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
        };
      }
    }

    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
    } as unknown as CanvasRenderingContext2D);

    try {
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: FakeOffscreenCanvas,
      });

      expect(createEncodingCanvas(80, 40).backend).toBe("offscreen");

      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: undefined,
      });

      expect(createEncodingCanvas(80, 40).backend).toBe("dom");
    } finally {
      getContextSpy.mockRestore();
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: originalOffscreenCanvas,
      });
    }
  });

  it("encodes JPEG through the browser canvas blob API with the requested quality", async () => {
    const convertToBlob = vi.fn(async (options: ImageEncodeOptions) => new Blob(["jpeg"], { type: options.type }));
    const canvas = { width: 10, height: 10, convertToBlob } as unknown as OffscreenCanvas;

    const blob = await canvasToBlobWithFormat(canvas, "jpeg", 0.72);

    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.72 });
    expect(blob.type).toBe("image/jpeg");
  });

  it("encodes WebP through the jSquash adapter using canvas image data", async () => {
    const imageData = {
      data: new Uint8ClampedArray(16),
      colorSpace: "srgb",
      height: 2,
      width: 2,
    } as ImageData;
    const canvas = {
      width: 2,
      height: 2,
      getContext: vi.fn(() => ({
        getImageData: vi.fn(() => imageData),
      })),
    } as unknown as HTMLCanvasElement;

    const blob = await canvasToBlobWithFormat(canvas, "webp", 80);

    expect(jsquashMock.encodeWebpWasm).toHaveBeenCalledWith(imageData, 80);
    expect(blob.type).toBe("image/webp");
  });

  it("clears tiny non-zero alpha pixels left by cutout masks", () => {
    const imageData = {
      data: new Uint8ClampedArray([
        255, 255, 255, 0,
        255, 255, 255, 3,
        255, 255, 255, 12,
        255, 255, 255, 13,
        12, 34, 56, 255,
      ]),
      colorSpace: "srgb",
      height: 1,
      width: 5,
    } as ImageData;
    const putImageData = vi.fn();
    const canvas = {
      width: 5,
      height: 1,
      getContext: vi.fn(() => ({
        getImageData: vi.fn(() => imageData),
        putImageData,
      })),
    } as unknown as HTMLCanvasElement;

    cleanLowAlphaPixels(canvas, 12);

    expect(Array.from(imageData.data)).toEqual([
      255, 255, 255, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      255, 255, 255, 13,
      12, 34, 56, 255,
    ]);
    expect(putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it("strengthens soft foreground alpha after background removal", () => {
    const imageData = {
      data: new Uint8ClampedArray([
        20, 20, 20, 0,
        180, 180, 180, 64,
        240, 240, 240, 12,
      ]),
      colorSpace: "srgb",
      height: 1,
      width: 3,
    } as ImageData;
    const putImageData = vi.fn();
    const canvas = {
      width: 3,
      height: 1,
      getContext: vi.fn(() => ({
        getImageData: vi.fn(() => imageData),
        putImageData,
      })),
    } as unknown as HTMLCanvasElement;

    refineBackgroundRemovalAlpha(canvas);

    expect(imageData.data[3]).toBe(0);
    expect(imageData.data[7]).toBeGreaterThan(128);
    expect(Array.from(imageData.data.slice(8, 12))).toEqual([0, 0, 0, 0]);
    expect(putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it("restores bright low-alpha components when the cutout mask has product holes", () => {
    const pixels = Array.from({ length: 25 }, () => [0, 0, 0, 0]).flat();
    const setPixel = (index: number, rgba: [number, number, number, number]) => {
      pixels.splice(index * 4, 4, ...rgba);
    };
    setPixel(12, [120, 120, 120, 96]);
    setPixel(7, [180, 180, 180, 0]);
    setPixel(11, [178, 178, 178, 4]);
    setPixel(13, [176, 176, 176, 8]);
    setPixel(17, [174, 174, 174, 12]);
    const imageData = {
      data: new Uint8ClampedArray(pixels),
      colorSpace: "srgb",
      height: 5,
      width: 5,
    } as ImageData;
    const putImageData = vi.fn();
    const canvas = {
      width: 5,
      height: 5,
      getContext: vi.fn(() => ({
        getImageData: vi.fn(() => imageData),
        putImageData,
      })),
    } as unknown as HTMLCanvasElement;

    refineBackgroundRemovalAlpha(canvas);

    expect(imageData.data[7 * 4 + 3]).toBe(255);
    expect(imageData.data[11 * 4 + 3]).toBe(255);
    expect(imageData.data[13 * 4 + 3]).toBe(255);
    expect(imageData.data[17 * 4 + 3]).toBe(255);
    expect(putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it("scales JPEG dimensions when browser quality alone cannot meet max size", async () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    const createJpegBlob = (width: number, height: number) => {
      const size = Math.ceil(width * height * 1.01);
      return new Blob([new Uint8Array(size)], { type: "image/jpeg" });
    };

    class FakeOffscreenCanvas {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(),
          imageSmoothingEnabled: false,
          imageSmoothingQuality: "low",
        };
      }

      async convertToBlob() {
        return createJpegBlob(this.width, this.height);
      }
    }

    Object.defineProperty(globalThis, "OffscreenCanvas", {
      configurable: true,
      value: FakeOffscreenCanvas,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const canvas = new FakeOffscreenCanvas(200, 200) as unknown as OffscreenCanvas;
      const blob = await compressLossyToMaxSize(canvas, "jpeg", 35_000, vi.fn());

      expect(blob.type).toBe("image/jpeg");
      expect(blob.size).toBeLessThanOrEqual(35_000);
    } finally {
      logSpy.mockRestore();
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        value: originalOffscreenCanvas,
      });
    }
  });
});
