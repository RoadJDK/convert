import { useCallback, useRef } from 'react';
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

// Detect Safari/WebKit - Safari has issues with WebP quality parameter
const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

// Test if the browser properly supports quality parameter for a given format
// Safari ignores quality for WebP in canvas.toBlob()
const supportsQualityForFormat = async (format: string): Promise<boolean> => {
  // PNG, GIF, BMP don't support quality parameter anyway
  if (['png', 'gif', 'bmp'].includes(format)) return true;
  
  // Safari has known issues with WebP quality
  if (isSafari() && format === 'webp') {
    return false;
  }
  
  return true;
};

// Convert canvas to blob using a format that supports quality, then convert if needed
const canvasToBlobWithQuality = async (
  canvas: HTMLCanvasElement,
  targetFormat: ImageOutputFormat,
  quality: number | undefined
): Promise<Blob> => {
  const mimeType = getOutputMimeType('image', targetFormat);
  
  // For Safari + WebP: Use JPEG as intermediate format to apply quality
  if (isSafari() && targetFormat === 'webp') {
    // Safari doesn't respect quality for WebP, so we:
    // 1. Convert to JPEG with quality (which Safari supports)
    // 2. Return as JPEG-quality-equivalent WebP via toBlob without quality
    //    (Safari will use default quality which is similar to our JPEG)
    
    // Actually, a better approach: Convert with JPEG quality first, 
    // then re-render that to WebP. This applies the quality compression.
    const jpegQuality = quality ?? 0.75;
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (jpegBlob) => {
          if (!jpegBlob) {
            reject(new Error('Failed to create JPEG blob'));
            return;
          }
          
          // Now load this JPEG and convert to WebP
          const img = new Image();
          img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to create temp canvas context'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            
            // Now convert to WebP - the quality is already baked into the image
            tempCanvas.toBlob(
              (webpBlob) => {
                URL.revokeObjectURL(img.src);
                if (webpBlob) {
                  resolve(webpBlob);
                } else {
                  reject(new Error('Failed to create WebP blob'));
                }
              },
              'image/webp'
            );
          };
          img.onerror = () => {
            reject(new Error('Failed to load intermediate JPEG'));
          };
          img.src = URL.createObjectURL(jpegBlob);
        },
        'image/jpeg',
        jpegQuality
      );
    });
  }
  
  // Standard path for browsers with proper WebP quality support
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      quality
    );
  });
};

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
            // For PNG, quality parameter is ignored (lossless format)
            // For other formats, use displayedToInternalQuality mapping
            const quality = outputFormat === 'png' 
              ? undefined 
              : displayedToInternalQuality(qualitySettings.percentage);
            
            try {
              const blob = await canvasToBlobWithQuality(canvas, outputFormat, quality);
              onProgress(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            } catch (err) {
              reject(err);
            }
          } else {
            // Binary search for target file size
            const targetBytes = qualitySettings.maxSizeKB * 1024;
            let minQ = 0.1;
            let maxQ = 0.92;
            let bestBlob: Blob | null = null;
            let iterations = 0;
            const maxIterations = 8;

            const tryQuality = async (quality: number): Promise<Blob | null> => {
              try {
                // For PNG, quality doesn't apply
                if (outputFormat === 'png') {
                  return new Promise((res) => {
                    canvas.toBlob((blob) => res(blob), mimeType);
                  });
                }
                return await canvasToBlobWithQuality(canvas, outputFormat, quality);
              } catch {
                return null;
              }
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