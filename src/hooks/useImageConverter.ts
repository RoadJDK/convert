import { useCallback } from "react";
import { QualitySettings, CropArea, getOutputMimeType, ImageOutputFormat } from "@/types/converter";
import { encodeWebpWasm, encodeAvifWasm, optimisePngWasm } from "@/lib/jsquash";

interface ConversionResult {
  blob: Blob;
  url: string;
}

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  addWhiteBackground?: boolean;
}

// Get ImageData from canvas
const getImageData = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

// Convert canvas to WebP using @jsquash/webp (WASM-based, consistent across browsers)
const canvasToWebpViaWasm = async (
  canvas: HTMLCanvasElement,
  quality: number, // 0-100 scale
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const webpBuffer = await encodeWebpWasm(imageData, quality);
  return new Blob([webpBuffer], { type: "image/webp" });
};

// Convert canvas to AVIF using @jsquash/avif (WASM-based, consistent across browsers)
const canvasToAvifViaWasm = async (
  canvas: HTMLCanvasElement,
  quality: number, // 0-100 scale
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const avifBuffer = await encodeAvifWasm(imageData, quality);
  return new Blob([avifBuffer], { type: "image/avif" });
};

// Optimise PNG using OxiPNG WASM (lossless optimization)
const optimisePngBuffer = async (pngBuffer: ArrayBuffer, level: number = 2): Promise<ArrayBuffer> => {
  try {
    return await optimisePngWasm(pngBuffer, level);
  } catch (e) {
    console.warn("[ImageConverter] OxiPNG optimization failed, using original:", e);
    return pngBuffer;
  }
};

// Convert canvas to PNG ArrayBuffer
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

/**
 * WebP quality mapping (for jsquash WASM, 0-100 scale):
 * - 50% displayed → quality 20 (aggressive compression, ~20-30% of original)
 * - 100% displayed → quality 75 (good balance, ~70-100% of original)
 * - 200% displayed → quality 100 (lossless mode)
 */
const displayedToWebpQuality = (displayed: number): number => {
  if (displayed <= 100) {
    // 50→20, 100→75 (steeper curve for more compression at low end)
    return Math.round(20 + ((displayed - 50) / 50) * 55);
  } else {
    // 100→75, 200→100
    return Math.round(75 + ((displayed - 100) / 100) * 25);
  }
};

/**
 * JPEG quality mapping (for canvas.toBlob, 0-1 scale):
 * - 50% displayed → quality 0.30 (aggressive compression)
 * - 100% displayed → quality 0.82 (good quality, ~original size)
 * - 200% displayed → quality 0.98 (near-maximum)
 */
const displayedToJpegQuality = (displayed: number): number => {
  if (displayed <= 100) {
    // 50→0.30, 100→0.82
    return 0.3 + ((displayed - 50) / 50) * 0.52;
  } else {
    // 100→0.82, 200→0.98
    return 0.82 + ((displayed - 100) / 100) * 0.16;
  }
};

/**
 * PNG scale mapping (PNG is lossless, so we control file size via dimensions):
 * - 50% displayed → 0.5 scale (25% pixels = ~25% file size)
 * - 100% displayed → 1.0 scale (original)
 * - 200% displayed → 2.0 scale (400% pixels = ~400% file size)
 */
const displayedToPngScale = (displayed: number): number => {
  return displayed / 100;
};

/**
 * AVIF quality mapping (for jsquash WASM, 0-100 scale):
 * - 50% displayed → quality 15 (very aggressive compression)
 * - 100% displayed → quality 50 (good balance, smaller than WebP)
 * - 200% displayed → quality 90 (near-lossless)
 *
 * AVIF is more efficient than WebP, so we use lower quality values
 * to achieve similar visual quality.
 */
const displayedToAvifQuality = (displayed: number): number => {
  if (displayed <= 100) {
    // 50→15, 100→50
    return Math.round(15 + ((displayed - 50) / 50) * 35);
  } else {
    // 100→50, 200→90
    return Math.round(50 + ((displayed - 100) / 100) * 40);
  }
};

// Scale canvas by a factor and return new canvas
const scaleCanvas = (sourceCanvas: HTMLCanvasElement, scaleFactor: number): HTMLCanvasElement => {
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

// Convert canvas to blob with format-specific handling
const canvasToBlobWithFormat = async (
  canvas: HTMLCanvasElement,
  targetFormat: ImageOutputFormat,
  quality?: number, // 0-1 for JPEG, 0-100 for WebP/AVIF WASM
  oxipngLevel: number = 2,
): Promise<Blob> => {
  // WebP: Always use WASM for consistency across browsers
  if (targetFormat === "webp") {
    const wasmQuality = quality !== undefined ? Math.round(quality) : 75;
    console.log("[ImageConverter] WebP WASM encoding with quality:", wasmQuality);
    return await canvasToWebpViaWasm(canvas, wasmQuality);
  }

  // AVIF: Always use WASM (browser support is inconsistent)
  if (targetFormat === "avif") {
    const wasmQuality = quality !== undefined ? Math.round(quality) : 50;
    console.log("[ImageConverter] AVIF WASM encoding with quality:", wasmQuality);
    return await canvasToAvifViaWasm(canvas, wasmQuality);
  }

  // PNG: Use canvas then optimize with OxiPNG
  if (targetFormat === "png") {
    const pngBuffer = await canvasToPngBuffer(canvas);
    const optimizedBuffer = await optimisePngBuffer(pngBuffer, oxipngLevel);
    return new Blob([optimizedBuffer], { type: "image/png" });
  }

  // JPEG and other formats: Use canvas.toBlob
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
      quality, // 0-1 for canvas.toBlob
    );
  });
};

export const useImageConverter = () => {
  const convertImage = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions,
    ): Promise<ConversionResult> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          onProgress(20);
          img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error("Failed to read file"));

        img.onload = async () => {
          onProgress(40);

          const { qualitySettings, cropArea, dimensions, addWhiteBackground } = options;
          const outputFormat = (qualitySettings.outputFormat as ImageOutputFormat) || "webp";

          // Calculate source dimensions (for cropping)
          const sx = cropArea?.x ?? 0;
          const sy = cropArea?.y ?? 0;
          const sWidth = cropArea?.width ?? img.width;
          const sHeight = cropArea?.height ?? img.height;

          // Calculate base target dimensions
          let targetWidth = cropArea ? cropArea.width : img.width;
          let targetHeight = cropArea ? cropArea.height : img.height;

          if (dimensions) {
            targetWidth = dimensions.width;
            targetHeight = dimensions.height;
          }

          // Apply user scale setting (separate from quality-based scaling)
          const userScale = qualitySettings.scale / 100;
          targetWidth = Math.round(targetWidth * userScale);
          targetHeight = Math.round(targetHeight * userScale);

          // Create base canvas at target dimensions
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to create canvas context"));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Add white background if needed (for transparent images going to JPEG)
          if (addWhiteBackground) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          onProgress(60);

          try {
            let blob: Blob;

            if (qualitySettings.mode === "percentage") {
              const displayedPct = qualitySettings.percentage;

              if (outputFormat === "png") {
                // PNG: Control size via dimensions (lossless format)
                const pngScale = displayedToPngScale(displayedPct);
                const scaledCanvas = pngScale !== 1.0 ? scaleCanvas(canvas, pngScale) : canvas;

                console.log(
                  "[ImageConverter] PNG scale:",
                  displayedPct,
                  "% ->",
                  pngScale,
                  `(${scaledCanvas.width}x${scaledCanvas.height})`,
                );

                blob = await canvasToBlobWithFormat(scaledCanvas, "png", undefined, 2);
              } else if (outputFormat === "webp") {
                // WebP: Use WASM with 0-100 quality scale
                const webpQuality = displayedToWebpQuality(displayedPct);
                console.log("[ImageConverter] WebP quality:", displayedPct, "% ->", webpQuality);
                blob = await canvasToBlobWithFormat(canvas, "webp", webpQuality);
              } else if (outputFormat === "jpeg") {
                // JPEG: Use canvas.toBlob with 0-1 quality scale
                const jpegQuality = displayedToJpegQuality(displayedPct);
                console.log("[ImageConverter] JPEG quality:", displayedPct, "% ->", jpegQuality.toFixed(2));
                blob = await canvasToBlobWithFormat(canvas, "jpeg", jpegQuality);
              } else if (outputFormat === "avif") {
                // AVIF: Use WASM encoder with 0-100 quality scale
                const avifQuality = displayedToAvifQuality(displayedPct);
                console.log("[ImageConverter] AVIF quality:", displayedPct, "% ->", avifQuality);
                blob = await canvasToBlobWithFormat(canvas, "avif", avifQuality);
              } else {
                // GIF, BMP: No quality control, just encode
                blob = await canvasToBlobWithFormat(canvas, outputFormat);
              }

              console.log("[ImageConverter] Result:", {
                format: outputFormat,
                inputSize: file.size,
                outputSize: blob.size,
                ratio: ((blob.size / file.size) * 100).toFixed(1) + "%",
              });

              onProgress(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            } else {
              // MaxSize mode: Binary search to fit target size
              const targetBytes = qualitySettings.maxSizeKB * 1024;

              if (outputFormat === "png") {
                // PNG: Scale down iteratively (quality doesn't help)
                blob = await compressPngToMaxSize(canvas, targetBytes, onProgress);
              } else {
                // Lossy formats: Binary search on quality, then scale if needed
                blob = await compressLossyToMaxSize(canvas, outputFormat, targetBytes, onProgress);
              }

              console.log("[ImageConverter] MaxSize result:", {
                format: outputFormat,
                targetKB: qualitySettings.maxSizeKB,
                actualKB: Math.round(blob.size / 1024),
                success: blob.size <= targetBytes,
              });

              onProgress(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            }
          } catch (err) {
            reject(err);
          }
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        reader.readAsDataURL(file);
      });
    },
    [],
  );

  const convertToWebP = convertImage;

  return { convertImage, convertToWebP };
};

/**
 * Compress PNG to max size by scaling down iteratively
 */
async function compressPngToMaxSize(
  canvas: HTMLCanvasElement,
  targetBytes: number,
  onProgress: (p: number) => void,
): Promise<Blob> {
  let currentCanvas = canvas;
  let scaleFactor = 1.0;
  let bestBlob: Blob | null = null;

  const maxIterations = 12;

  for (let i = 0; i < maxIterations; i++) {
    // Use higher OxiPNG level for maxSize mode
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

    // Store as fallback (best we could do)
    if (!bestBlob || testBlob.size < bestBlob.size) {
      bestBlob = testBlob;
    }

    // Calculate new scale: PNG size ≈ proportional to pixel count
    // Target 70% of limit to leave headroom
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
}

/**
 * Compress lossy format (WebP/JPEG/AVIF) to max size via binary search
 */
async function compressLossyToMaxSize(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  targetBytes: number,
  onProgress: (p: number) => void,
): Promise<Blob> {
  // WebP and AVIF use 0-100 scale, JPEG uses 0-1 scale
  const usesWasmScale = format === "webp" || format === "avif";

  // Quality ranges
  let minQ = usesWasmScale ? 1 : 0.05;
  let maxQ = usesWasmScale ? 100 : 0.98;
  let bestBlob: Blob | null = null;
  let bestQuality = minQ;

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
      bestQuality = midQ;
      minQ = midQ; // Try higher quality
    } else {
      maxQ = midQ; // Need lower quality
    }

    // Converged
    if ((usesWasmScale && maxQ - minQ < 2) || (!usesWasmScale && maxQ - minQ < 0.02)) {
      break;
    }

    onProgress(70 + (i / maxIterations) * 20);
  }

  // If still over target, try minimum quality
  if (!bestBlob || bestBlob.size > targetBytes) {
    const minBlob = await canvasToBlobWithFormat(canvas, format, minQ);
    if (minBlob.size <= targetBytes || !bestBlob) {
      bestBlob = minBlob;
    }
  }

  // Last resort: scale down if quality alone can't achieve target
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
}

// Re-export scaleCanvas for use in compressLossyToMaxSize
const canvasToBlobWithFormat_external = canvasToBlobWithFormat;
