import { useCallback } from "react";
import { QualitySettings, CropArea, ImageOutputFormat } from "@/types/converter";
import {
  canvasToBlobWithFormat,
  compressLossyToMaxSize,
  compressPngToMaxSize,
  displayedToAvifQuality,
  displayedToJpegQuality,
  displayedToPngScale,
  displayedToWebpQuality,
  scaleCanvas,
} from "@/lib/imageEncoding";
import { applyWatermarkCleanup } from "@/lib/watermarkCleanup";
import { readDisplayableImageAsDataUrl } from "@/lib/displayableImage";

interface ConversionResult {
  blob: Blob;
  url: string;
}

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  addWhiteBackground?: boolean;
  removeWatermark?: boolean;
}

export const useImageConverter = () => {
  const convertImage = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions,
    ): Promise<ConversionResult> => {
      const dataUrl = await readDisplayableImageAsDataUrl(file);
      onProgress(20);

      return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = async () => {
          onProgress(40);

          const { qualitySettings, cropArea, dimensions, addWhiteBackground, removeWatermark } = options;
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
          if (removeWatermark) {
            applyWatermarkCleanup(canvas);
          }
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
              } else if (outputFormat === "svg") {
                blob = await canvasToBlobWithFormat(canvas, "svg");
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

              if (outputFormat === "svg") {
                blob = await canvasToBlobWithFormat(canvas, "svg");
              } else if (outputFormat === "png") {
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
        img.src = dataUrl;
      });
    },
    [],
  );

  const convertToWebP = convertImage;

  return { convertImage, convertToWebP };
};
