import { useCallback } from 'react';
import { QualitySettings, CropArea, displayedToInternalQuality, getOutputMimeType, ImageOutputFormat } from '@/types/converter';

interface ConversionResult {
  blob: Blob;
  url: string;
}

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  addWhiteBackground?: boolean; // For converting transparent images to non-transparent formats
}

export const useImageConverter = () => {
  const convertImage = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions
    ): Promise<ConversionResult> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          onProgress(20);
          img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        img.onload = async () => {
          onProgress(40);

          const { qualitySettings, cropArea, dimensions, addWhiteBackground } = options;
          
          // Determine output format and mime type
          const outputFormat = (qualitySettings.outputFormat as ImageOutputFormat) || 'webp';
          const mimeType = getOutputMimeType('image', outputFormat);

          // Calculate source dimensions (for cropping)
          const sx = cropArea?.x ?? 0;
          const sy = cropArea?.y ?? 0;
          const sWidth = cropArea?.width ?? img.width;
          const sHeight = cropArea?.height ?? img.height;

          // Calculate final dimensions with scale
          let targetWidth = cropArea ? cropArea.width : img.width;
          let targetHeight = cropArea ? cropArea.height : img.height;

          // Apply custom dimensions if set
          if (dimensions) {
            targetWidth = dimensions.width;
            targetHeight = dimensions.height;
          }

          // Apply scale factor
          const scale = qualitySettings.scale / 100;
          targetWidth = Math.round(targetWidth * scale);
          targetHeight = Math.round(targetHeight * scale);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }

          // Use high-quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Add white background if needed (for transparent images to non-transparent formats)
          if (addWhiteBackground) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          onProgress(60);

          if (qualitySettings.mode === 'percentage') {
            // displayedToInternalQuality now returns 0.4-0.92 directly
            const quality = outputFormat === 'png' ? undefined : displayedToInternalQuality(qualitySettings.percentage);
            
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  onProgress(100);
                  const url = URL.createObjectURL(blob);
                  resolve({ blob, url });
                } else {
                  reject(new Error('Failed to convert image'));
                }
              },
              mimeType,
              quality
            );
          } else {
            // Binary search for target file size
            const targetBytes = qualitySettings.maxSizeKB * 1024;
            let minQ = 0.1;
            let maxQ = 0.92;
            let bestBlob: Blob | null = null;
            let iterations = 0;
            const maxIterations = 8;

            const tryQuality = (quality: number): Promise<Blob | null> => {
              return new Promise((res) => {
                canvas.toBlob(
                  (blob) => res(blob),
                  mimeType,
                  // PNG doesn't support quality
                  outputFormat === 'png' ? undefined : quality
                );
              });
            };

            onProgress(70);

            // For PNG, just do one conversion since quality doesn't apply
            if (outputFormat === 'png') {
              const blob = await tryQuality(1);
              if (blob) {
                onProgress(100);
                const url = URL.createObjectURL(blob);
                resolve({ blob, url });
              } else {
                reject(new Error('Failed to convert image'));
              }
              return;
            }

            while (iterations < maxIterations) {
              const midQ = (minQ + maxQ) / 2;
              const blob = await tryQuality(midQ);
              
              if (!blob) break;

              if (blob.size <= targetBytes) {
                bestBlob = blob;
                minQ = midQ;
              } else {
                maxQ = midQ;
              }

              iterations++;
              onProgress(70 + (iterations / maxIterations) * 25);
            }

            // If we couldn't get under target, use lowest quality result
            if (!bestBlob) {
              bestBlob = await tryQuality(0.1);
            }

            if (bestBlob) {
              onProgress(100);
              const url = URL.createObjectURL(bestBlob);
              resolve({ blob: bestBlob, url });
            } else {
              reject(new Error('Failed to convert image'));
            }
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        reader.readAsDataURL(file);
      });
    },
    []
  );

  // Backwards compatibility alias
  const convertToWebP = convertImage;

  return { convertImage, convertToWebP };
};