import { beforeEach, describe, expect, it, vi } from "vitest";

const removeBackgroundMock = vi.hoisted(() => vi.fn(async () => new Blob(["clean"], { type: "image/png" })));
const canvasToBrowserPngBlobMock = vi.hoisted(() => vi.fn());
const createEncodingCanvasMock = vi.hoisted(() => vi.fn());
const refineBackgroundRemovalAlphaMock = vi.hoisted(() => vi.fn());

vi.mock("@imgly/background-removal", () => ({
  removeBackground: removeBackgroundMock,
}));

vi.mock("@/lib/imageEncoding", () => ({
  canvasToBrowserPngBlob: canvasToBrowserPngBlobMock,
  createEncodingCanvas: createEncodingCanvasMock,
  refineBackgroundRemovalAlpha: refineBackgroundRemovalAlphaMock,
}));

import {
  applyAlphaMaskToImageData,
  composeBackgroundRemovalMaskWithOriginal,
  removeImageBackground,
  type BackgroundRemovalConfig,
} from "@/lib/backgroundRemoval";

class FakeImageData {
  data: Uint8ClampedArray;
  height: number;
  width: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

describe("removeImageBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the bundled browser package instead of remote code imports", async () => {
    const input = new Blob(["source"], { type: "image/png" });
    const config: BackgroundRemovalConfig = {
      device: "cpu",
      model: "isnet_fp16",
      output: {
        format: "image/png",
        quality: 1,
      },
      progress: vi.fn(),
      publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
    };

    const result = await removeImageBackground(input, config);

    expect(result.type).toBe("image/png");
    expect(removeBackgroundMock).toHaveBeenCalledWith(input, config);
  });

  it("keeps original RGB while applying the background-removal alpha mask", () => {
    const originalImageData = globalThis.ImageData;
    Object.defineProperty(globalThis, "ImageData", {
      configurable: true,
      value: FakeImageData,
    });

    const source = {
      data: new Uint8ClampedArray([
        250, 240, 230, 255,
        120, 80, 40, 255,
      ]),
      colorSpace: "srgb",
      height: 1,
      width: 2,
    } as ImageData;
    const mask = {
      data: new Uint8ClampedArray([
        0, 0, 0, 0,
        255, 255, 255, 128,
      ]),
      colorSpace: "srgb",
      height: 1,
      width: 2,
    } as ImageData;

    try {
      const output = applyAlphaMaskToImageData(source, mask);

      expect(Array.from(output.data)).toEqual([
        250, 240, 230, 0,
        120, 80, 40, 128,
      ]);
    } finally {
      Object.defineProperty(globalThis, "ImageData", {
        configurable: true,
        value: originalImageData,
      });
    }
  });

  it("composes the model alpha mask onto original RGB before final encoding", async () => {
    const originalImageData = globalThis.ImageData;
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, "ImageData", {
      configurable: true,
      value: FakeImageData,
    });

    const originalBlob = new Blob(["original"], { type: "image/webp" });
    const maskBlob = new Blob(["mask"], { type: "image/png" });
    const outputBlob = new Blob(["composed"], { type: "image/png" });
    const originalBitmap = { close: vi.fn(), height: 1, width: 2 };
    const maskBitmap = { close: vi.fn(), height: 1, width: 2 };
    const sourceCanvas = { height: 1, width: 2 };
    const maskCanvas = { height: 1, width: 2 };
    const sourceContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray([
          240, 230, 220, 255,
          120, 80, 40, 255,
        ]),
        colorSpace: "srgb",
        height: 1,
        width: 2,
      } as ImageData)),
      putImageData: vi.fn(),
    };
    const maskContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray([
          0, 0, 0, 0,
          255, 255, 255, 192,
        ]),
        colorSpace: "srgb",
        height: 1,
        width: 2,
      } as ImageData)),
    };

    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: vi.fn(async (blob: Blob) => {
        if (blob === originalBlob) return originalBitmap;
        if (blob === maskBlob) return maskBitmap;
        throw new Error("Unexpected image blob");
      }),
    });
    createEncodingCanvasMock
      .mockReturnValueOnce({ backend: "dom", canvas: sourceCanvas, context: sourceContext })
      .mockReturnValueOnce({ backend: "dom", canvas: maskCanvas, context: maskContext });
    canvasToBrowserPngBlobMock.mockResolvedValue(outputBlob);

    try {
      const result = await composeBackgroundRemovalMaskWithOriginal(originalBlob, maskBlob);

      expect(result).toBe(outputBlob);
      expect(sourceContext.drawImage).toHaveBeenCalledWith(originalBitmap, 0, 0, 2, 1);
      expect(maskContext.drawImage).toHaveBeenCalledWith(maskBitmap, 0, 0, 2, 1);
      expect(sourceContext.putImageData).toHaveBeenCalledTimes(1);
      expect(Array.from(sourceContext.putImageData.mock.calls[0][0].data)).toEqual([
        240, 230, 220, 0,
        120, 80, 40, 192,
      ]);
      expect(refineBackgroundRemovalAlphaMock).toHaveBeenCalledWith(sourceCanvas);
      expect(canvasToBrowserPngBlobMock).toHaveBeenCalledWith(sourceCanvas);
      expect(originalBitmap.close).toHaveBeenCalled();
      expect(maskBitmap.close).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "ImageData", {
        configurable: true,
        value: originalImageData,
      });
      Object.defineProperty(globalThis, "createImageBitmap", {
        configurable: true,
        value: originalCreateImageBitmap,
      });
    }
  });
});
