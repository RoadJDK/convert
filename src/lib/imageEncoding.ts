import { getOutputMimeType, type ImageOutputFormat } from "@/types/converter";
import { encodeAvifWasm, encodeWebpWasm, optimisePngWasm } from "@/lib/jsquash";

export type EncodingCanvas = HTMLCanvasElement | OffscreenCanvas;
type EncodingContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type EncodingBackend = "offscreen" | "dom";

type CodecEncodeOptions = {
  format: ImageOutputFormat;
  quality?: number;
  oxipngLevel: number;
};

type ImageEncodeWorkerRequest =
  | {
      id: number;
      type: "encode-image-data";
      format: "webp" | "avif";
      imageData: ImageData;
      quality: number;
    }
  | {
      id: number;
      type: "optimise-png";
      pngBuffer: ArrayBuffer;
      level: number;
    };

type ImageEncodeWorkerResponse =
  | {
      id: number;
      ok: true;
      buffer: ArrayBuffer;
    }
  | {
      id: number;
      ok: false;
      error: string;
    };

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type ImageEncodeWorkerPayload = DistributiveOmit<ImageEncodeWorkerRequest, "id">;

export type ImageCodecAdapter = {
  id: "jsquash-webp" | "jsquash-avif" | "jsquash-png" | "browser-canvas" | "svg-data-url";
  encode: (canvas: EncodingCanvas, options: CodecEncodeOptions) => Promise<Blob>;
};

export type EncodingCanvasResource = {
  backend: EncodingBackend;
  canvas: EncodingCanvas;
  context: EncodingContext2D;
};

let imageEncodeWorker: Worker | null = null;
let imageEncodeWorkerRequestId = 0;
const imageEncodeWorkerRequests = new Map<
  number,
  {
    reject: (error: Error) => void;
    resolve: (buffer: ArrayBuffer) => void;
  }
>();

const rejectPendingWorkerRequests = (error: Error) => {
  imageEncodeWorkerRequests.forEach(({ reject }) => reject(error));
  imageEncodeWorkerRequests.clear();
};

const getImageEncodeWorker = (): Worker => {
  if (imageEncodeWorker) return imageEncodeWorker;

  imageEncodeWorker = new Worker(new URL("../workers/imageEncode.worker.ts", import.meta.url), {
    type: "module",
  });

  imageEncodeWorker.onmessage = (event: MessageEvent<ImageEncodeWorkerResponse>) => {
    const response = event.data;
    const request = imageEncodeWorkerRequests.get(response.id);
    if (!request) return;

    imageEncodeWorkerRequests.delete(response.id);

    if ("buffer" in response) {
      request.resolve(response.buffer);
    } else {
      request.reject(new Error(response.error));
    }
  };

  imageEncodeWorker.onerror = () => {
    const error = new Error("Image encode worker failed");
    rejectPendingWorkerRequests(error);
    imageEncodeWorker?.terminate();
    imageEncodeWorker = null;
  };

  return imageEncodeWorker;
};

const runImageEncodeWorker = (
  request: ImageEncodeWorkerPayload,
): Promise<ArrayBuffer> => {
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Image encode worker unavailable"));
  }

  const id = imageEncodeWorkerRequestId + 1;
  imageEncodeWorkerRequestId = id;

  return new Promise((resolve, reject) => {
    imageEncodeWorkerRequests.set(id, { resolve, reject });
    getImageEncodeWorker().postMessage({ ...request, id });
  });
};

export const createEncodingCanvas = (
  width: number,
  height: number,
  options: { preferOffscreen?: boolean; willReadFrequently?: boolean } = {},
): EncodingCanvasResource => {
  const canvasWidth = Math.max(1, Math.round(width));
  const canvasHeight = Math.max(1, Math.round(height));
  const preferOffscreen = options.preferOffscreen ?? true;

  if (preferOffscreen && typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext("2d", { willReadFrequently: options.willReadFrequently ?? false });
    if (!context) throw new Error("Failed to create canvas context");
    return { backend: "offscreen", canvas, context };
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d", { willReadFrequently: options.willReadFrequently ?? false });
  if (!context) throw new Error("Failed to create canvas context");
  return { backend: "dom", canvas, context };
};

const getImageData = (canvas: EncodingCanvas): ImageData => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const canvasToWebpViaWasm = async (
  canvas: EncodingCanvas,
  quality: number,
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const webpBuffer = await runImageEncodeWorker({
    type: "encode-image-data",
    format: "webp",
    imageData,
    quality,
  }).catch(() => encodeWebpWasm(imageData, quality));
  return new Blob([webpBuffer], { type: "image/webp" });
};

const canvasToAvifViaWasm = async (
  canvas: EncodingCanvas,
  quality: number,
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const avifBuffer = await runImageEncodeWorker({
    type: "encode-image-data",
    format: "avif",
    imageData,
    quality,
  }).catch(() => encodeAvifWasm(imageData, quality));
  return new Blob([avifBuffer], { type: "image/avif" });
};

const optimisePngBuffer = async (pngBuffer: ArrayBuffer, level: number = 2): Promise<ArrayBuffer> => {
  try {
    return await runImageEncodeWorker({
      type: "optimise-png",
      pngBuffer,
      level,
    });
  } catch (error) {
    try {
      return await optimisePngWasm(pngBuffer, level);
    } catch (fallbackError) {
      console.warn("[ImageConverter] OxiPNG optimization failed, using original:", fallbackError);
      return pngBuffer;
    }
  }
};

const canvasToBlobByBrowser = (
  canvas: EncodingCanvas,
  type: string,
  quality?: number,
): Promise<Blob> => {
  if ("convertToBlob" in canvas && typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }

  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to create ${type} blob. Format may not be supported.`));
        }
      },
      type,
      quality,
    );
  });
};

const canvasToPngBuffer = (canvas: EncodingCanvas): Promise<ArrayBuffer> => {
  return canvasToBlobByBrowser(canvas, "image/png").then((blob) => blob.arrayBuffer());
};

export const canvasToBrowserPngBlob = (canvas: EncodingCanvas): Promise<Blob> => {
  return canvasToBlobByBrowser(canvas, "image/png");
};

const canvasToSvgBlob = (canvas: EncodingCanvas): Blob => {
  if (!("toDataURL" in canvas)) {
    throw new Error("SVG export requires a DOM canvas");
  }

  const imageDataUrl = canvas.toDataURL("image/png");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
    `<image width="${canvas.width}" height="${canvas.height}" href="${imageDataUrl}" />`,
    "</svg>",
  ].join("");

  return new Blob([svg], { type: "image/svg+xml" });
};

const imageCodecAdapters: ImageCodecAdapter[] = [
  {
    id: "jsquash-webp",
    encode: (canvas, options) => canvasToWebpViaWasm(canvas, Math.round(options.quality ?? 75)),
  },
  {
    id: "jsquash-avif",
    encode: (canvas, options) => canvasToAvifViaWasm(canvas, Math.round(options.quality ?? 50)),
  },
  {
    id: "jsquash-png",
    encode: async (canvas, options) => {
      const pngBuffer = await canvasToPngBuffer(canvas);
      const optimizedBuffer = await optimisePngBuffer(pngBuffer, options.oxipngLevel);
      return new Blob([optimizedBuffer], { type: "image/png" });
    },
  },
  {
    id: "svg-data-url",
    encode: async (canvas) => canvasToSvgBlob(canvas),
  },
  {
    id: "browser-canvas",
    encode: (canvas, options) => {
      const mimeType = getOutputMimeType("image", options.format);
      return canvasToBlobByBrowser(canvas, mimeType, options.quality);
    },
  },
];

export const getImageCodecAdapter = (format: ImageOutputFormat): ImageCodecAdapter => {
  if (format === "webp") return imageCodecAdapters[0];
  if (format === "avif") return imageCodecAdapters[1];
  if (format === "png") return imageCodecAdapters[2];
  if (format === "svg") return imageCodecAdapters[3];
  return imageCodecAdapters[4];
};

export const displayedToWebpQuality = (displayed: number): number => {
  if (displayed <= 100) {
    return Math.round(20 + ((displayed - 50) / 50) * 55);
  }
  return Math.round(75 + ((displayed - 100) / 100) * 25);
};

export const displayedToJpegQuality = (displayed: number): number => {
  if (displayed <= 100) {
    return 0.3 + ((displayed - 50) / 50) * 0.52;
  }
  return 0.82 + ((displayed - 100) / 100) * 0.16;
};

export const displayedToPngScale = (displayed: number): number => {
  return displayed / 100;
};

export const displayedToAvifQuality = (displayed: number): number => {
  if (displayed <= 100) {
    return Math.round(15 + ((displayed - 50) / 50) * 35);
  }
  return Math.round(50 + ((displayed - 100) / 100) * 40);
};

export const scaleCanvas = (sourceCanvas: EncodingCanvas, scaleFactor: number): EncodingCanvas => {
  const { canvas: newCanvas, context: ctx } = createEncodingCanvas(
    sourceCanvas.width * scaleFactor,
    sourceCanvas.height * scaleFactor,
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, newCanvas.width, newCanvas.height);

  return newCanvas;
};

export const cleanLowAlphaPixels = (canvas: EncodingCanvas, alphaThreshold: number = 12): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const threshold = Math.max(0, Math.min(255, Math.round(alphaThreshold)));

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] > 0 && data[offset + 3] <= threshold) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

const getLuminance = (data: Uint8ClampedArray, offset: number): number => {
  return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
};

const shouldRestoreBrightLowAlphaPixel = (
  data: Uint8ClampedArray,
  pixelIndex: number,
  alphaMax: number,
  luminanceMin: number,
): boolean => {
  const offset = pixelIndex * 4;
  return data[offset + 3] <= alphaMax && getLuminance(data, offset) >= luminanceMin;
};

export const refineBackgroundRemovalAlpha = (canvas: EncodingCanvas): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const width = canvas.width;
  const height = canvas.height;
  const totalPixels = width * height;

  const lowAlphaThreshold = 12;
  const alphaCurveMin = 16;
  const alphaCurvePower = 0.35;
  const restoreAlphaMax = 48;
  const restoreLuminanceMin = 40;
  const restoreRatioGate = 0.08;
  const restoreTouchAlpha = 64;
  const restoreMinComponentPixels = 500;

  const restoreCandidates = new Uint8Array(totalPixels);
  let restoreCandidateCount = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    if (shouldRestoreBrightLowAlphaPixel(data, pixel, restoreAlphaMax, restoreLuminanceMin)) {
      restoreCandidates[pixel] = 1;
      restoreCandidateCount += 1;
    }
  }

  if (restoreCandidateCount / totalPixels >= restoreRatioGate) {
    const seen = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    const component: number[] = [];

    for (let start = 0; start < totalPixels; start += 1) {
      if (!restoreCandidates[start] || seen[start]) continue;

      component.length = 0;
      let head = 0;
      let tail = 0;
      let touchesBorder = false;
      let touchesForeground = false;

      queue[tail] = start;
      tail += 1;
      seen[start] = 1;

      const enqueueNeighbor = (neighbor: number) => {
        if (data[neighbor * 4 + 3] > restoreTouchAlpha) {
          touchesForeground = true;
        }

        if (restoreCandidates[neighbor] && !seen[neighbor]) {
          seen[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      };

      while (head < tail) {
        const pixel = queue[head];
        head += 1;
        component.push(pixel);

        const x = pixel % width;
        const y = Math.floor(pixel / width);
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          touchesBorder = true;
        }

        if (x > 0) enqueueNeighbor(pixel - 1);
        if (x < width - 1) enqueueNeighbor(pixel + 1);
        if (y > 0) enqueueNeighbor(pixel - width);
        if (y < height - 1) enqueueNeighbor(pixel + width);
      }

      if (!touchesBorder && (touchesForeground || component.length >= restoreMinComponentPixels)) {
        for (const pixel of component) {
          data[pixel * 4 + 3] = 255;
        }
      }
    }
  }

  for (let offset = 0; offset < data.length; offset += 4) {
    const alpha = data[offset + 3];

    if (alpha > 0 && alpha <= lowAlphaThreshold) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      continue;
    }

    if (alpha >= alphaCurveMin) {
      const curvedAlpha = Math.round(255 * Math.pow(alpha / 255, alphaCurvePower));
      data[offset + 3] = Math.max(alpha, Math.min(255, curvedAlpha));
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

export const canvasToBlobWithFormat = async (
  canvas: EncodingCanvas,
  targetFormat: ImageOutputFormat,
  quality?: number,
  oxipngLevel: number = 2,
): Promise<Blob> => {
  const adapter = getImageCodecAdapter(targetFormat);
  return adapter.encode(canvas, { format: targetFormat, quality, oxipngLevel });
};

export const compressPngToMaxSize = async (
  canvas: EncodingCanvas,
  targetBytes: number,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  let currentCanvas: EncodingCanvas = canvas;
  let scaleFactor = 1.0;
  let bestBlob: Blob | null = null;

  const maxIterations = 12;

  for (let i = 0; i < maxIterations; i++) {
    const pngBuffer = await canvasToPngBuffer(currentCanvas);
    const optimizedBuffer = await optimisePngBuffer(pngBuffer, 4);
    const testBlob = new Blob([optimizedBuffer], { type: "image/png" });

    console.log("[ImageConverter] PNG MaxSize iteration:", {
      iteration: i,
      scaleFactor: scaleFactor.toFixed(3),
      dimensions: `${currentCanvas.width}x${currentCanvas.height}`,
      size: testBlob.size,
      target: targetBytes,
    });

    if (testBlob.size <= targetBytes) {
      bestBlob = testBlob;
      break;
    }

    if (!bestBlob || testBlob.size < bestBlob.size) {
      bestBlob = testBlob;
    }

    const sizeRatio = (targetBytes * 0.7) / testBlob.size;
    const dimensionRatio = Math.sqrt(sizeRatio);
    scaleFactor *= dimensionRatio;

    if (scaleFactor < 0.05) {
      console.warn("[ImageConverter] PNG cannot reach target size at minimum scale");
      break;
    }

    currentCanvas = scaleCanvas(canvas, scaleFactor);
    onProgress(70 + (i / maxIterations) * 25);
  }

  return bestBlob || (await canvasToBlobWithFormat(canvas, "png"));
};

export const compressLossyToMaxSize = async (
  canvas: EncodingCanvas,
  format: ImageOutputFormat,
  targetBytes: number,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  const usesWasmScale = format === "webp" || format === "avif";
  let minQ = usesWasmScale ? 1 : 0.05;
  let maxQ = usesWasmScale ? 100 : 0.98;
  let bestBlob: Blob | null = null;

  const maxIterations = 12;

  for (let i = 0; i < maxIterations; i++) {
    const midQ = (minQ + maxQ) / 2;
    const testBlob = await canvasToBlobWithFormat(canvas, format, midQ);

    console.log("[ImageConverter] MaxSize binary search:", {
      iteration: i,
      format,
      quality: usesWasmScale ? midQ : midQ.toFixed(2),
      size: testBlob.size,
      target: targetBytes,
    });

    if (testBlob.size <= targetBytes) {
      bestBlob = testBlob;
      minQ = midQ;
    } else {
      maxQ = midQ;
    }

    if ((usesWasmScale && maxQ - minQ < 2) || (!usesWasmScale && maxQ - minQ < 0.02)) {
      break;
    }

    onProgress(70 + (i / maxIterations) * 20);
  }

  if (!bestBlob || bestBlob.size > targetBytes) {
    const minBlob = await canvasToBlobWithFormat(canvas, format, minQ);
    if (minBlob.size <= targetBytes || !bestBlob) {
      bestBlob = minBlob;
    }
  }

  if (bestBlob && bestBlob.size > targetBytes) {
    console.log("[ImageConverter] Quality alone insufficient, scaling down...");
    let scaleFactor = 0.9;

    for (let i = 0; i < 5 && bestBlob.size > targetBytes; i++) {
      const scaledCanvas = scaleCanvas(canvas, scaleFactor);
      bestBlob = await canvasToBlobWithFormat(scaledCanvas, format, usesWasmScale ? 50 : 0.5);

      console.log("[ImageConverter] Scale iteration:", {
        scale: scaleFactor.toFixed(2),
        size: bestBlob.size,
      });

      scaleFactor *= 0.8;
      onProgress(90 + i * 2);
    }
  }

  return bestBlob!;
};
