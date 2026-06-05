import { getOutputMimeType, type ImageOutputFormat } from "@/types/converter";
import { encodeAvifWasm, encodeWebpWasm, optimisePngWasm } from "@/lib/jsquash";

const getImageData = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const canvasToWebpViaWasm = async (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const webpBuffer = await encodeWebpWasm(imageData, quality);
  return new Blob([webpBuffer], { type: "image/webp" });
};

const canvasToAvifViaWasm = async (
  canvas: HTMLCanvasElement,
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

const canvasToPngBuffer = (canvas: HTMLCanvasElement): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (blob) {
        resolve(await blob.arrayBuffer());
      } else {
        reject(new Error("Failed to create PNG blob"));
      }
    }, "image/png");
  });
};

const canvasToSvgBlob = (canvas: HTMLCanvasElement): Blob => {
  const imageDataUrl = canvas.toDataURL("image/png");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
    `<image width="${canvas.width}" height="${canvas.height}" href="${imageDataUrl}" />`,
    "</svg>",
  ].join("");

  return new Blob([svg], { type: "image/svg+xml" });
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

export const scaleCanvas = (sourceCanvas: HTMLCanvasElement, scaleFactor: number): HTMLCanvasElement => {
  const newCanvas = document.createElement("canvas");
  newCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scaleFactor));
  newCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scaleFactor));

  const ctx = newCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, newCanvas.width, newCanvas.height);

  return newCanvas;
};

export const canvasToBlobWithFormat = async (
  canvas: HTMLCanvasElement,
  targetFormat: ImageOutputFormat,
  quality?: number,
  oxipngLevel: number = 2,
): Promise<Blob> => {
  if (targetFormat === "webp") {
    const wasmQuality = quality !== undefined ? Math.round(quality) : 75;
    console.log("[ImageConverter] WebP WASM encoding with quality:", wasmQuality);
    return await canvasToWebpViaWasm(canvas, wasmQuality);
  }

  if (targetFormat === "avif") {
    const wasmQuality = quality !== undefined ? Math.round(quality) : 50;
    console.log("[ImageConverter] AVIF WASM encoding with quality:", wasmQuality);
    return await canvasToAvifViaWasm(canvas, wasmQuality);
  }

  if (targetFormat === "png") {
    const pngBuffer = await canvasToPngBuffer(canvas);
    const optimizedBuffer = await optimisePngBuffer(pngBuffer, oxipngLevel);
    return new Blob([optimizedBuffer], { type: "image/png" });
  }

  if (targetFormat === "svg") {
    return canvasToSvgBlob(canvas);
  }

  const mimeType = getOutputMimeType("image", targetFormat);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to create ${targetFormat} blob. Format may not be supported.`));
        }
      },
      mimeType,
      quality,
    );
  });
};

export const compressPngToMaxSize = async (
  canvas: HTMLCanvasElement,
  targetBytes: number,
  onProgress: (progress: number) => void,
): Promise<Blob> => {
  let currentCanvas = canvas;
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
  canvas: HTMLCanvasElement,
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
