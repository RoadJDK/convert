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

export type ImageCodecAdapter = {
  id: "jsquash-webp" | "jsquash-avif" | "jsquash-png" | "browser-canvas" | "svg-data-url";
  encode: (canvas: EncodingCanvas, options: CodecEncodeOptions) => Promise<Blob>;
};

export type EncodingCanvasResource = {
  backend: EncodingBackend;
  canvas: EncodingCanvas;
  context: EncodingContext2D;
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
  const webpBuffer = await encodeWebpWasm(imageData, quality);
  return new Blob([webpBuffer], { type: "image/webp" });
};

const canvasToAvifViaWasm = async (
  canvas: EncodingCanvas,
  quality: number,
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const avifBuffer = await encodeAvifWasm(imageData, quality);
  return new Blob([avifBuffer], { type: "image/avif" });
};

const optimisePngBuffer = async (pngBuffer: ArrayBuffer, level: number = 2): Promise<ArrayBuffer> => {
  try {
    return await optimisePngWasm(pngBuffer, level);
  } catch (error) {
    console.warn("[ImageConverter] OxiPNG optimization failed, using original:", error);
    return pngBuffer;
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
