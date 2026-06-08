import { describe, expect, it, vi } from "vitest";

const jsquashMock = vi.hoisted(() => ({
  encodeAvifWasm: vi.fn(async () => new Uint8Array([4, 5, 6]).buffer),
  encodeWebpWasm: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  optimisePngWasm: vi.fn(async (buffer: ArrayBuffer) => buffer),
}));

vi.mock("@/lib/jsquash", () => jsquashMock);

import {
  canvasToBlobWithFormat,
  compressLossyToMaxSize,
  createEncodingCanvas,
  getImageCodecAdapter,
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
