import { useCallback } from 'react';
import { QualitySettings, CropArea, displayedToInternalQuality, getOutputMimeType, ImageOutputFormat } from '@/types/converter';
import { encode as encodeWebp } from '@jsquash/webp';

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

// Detect Safari/WebKit - Safari has issues with WebP quality parameter
const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

// Get ImageData from canvas
const getImageData = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

// Convert canvas to WebP using @jsquash/webp (WASM-based, works everywhere including Safari)
const canvasToWebpViaWasm = async (
  canvas: HTMLCanvasElement,
  quality: number // 0-100 scale
): Promise<Blob> => {
  const imageData = getImageData(canvas);
  const webpBuffer = await encodeWebp(imageData, { quality });
  return new Blob([webpBuffer], { type: 'image/webp' });
};

// Convert canvas to blob with quality support
// For WebP on Safari, use WASM encoder as fallback if native fails
const canvasToBlobWithQuality = async (
  canvas: HTMLCanvasElement,
  targetFormat: ImageOutputFormat,
  quality: number | undefined
): Promise<Blob> => {
  const mimeType = getOutputMimeType('image', targetFormat);
  
  // For WebP, try native first, then WASM fallback if result is not actually WebP
  if (targetFormat === 'webp') {
    // Try native canvas.toBlob first
    const nativeBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        quality
      );
    });
    
    // Check if we actually got WebP (Safari often returns PNG instead)
    if (nativeBlob && nativeBlob.type === 'image/webp') {
      console.log('[ImageConverter] Native WebP encoding succeeded');
      return nativeBlob;
    }
    
    // Fallback to WASM encoder for Safari
    console.log('[ImageConverter] Native WebP failed/returned wrong type, using WASM encoder');
    const wasmQuality = quality !== undefined ? Math.round(quality * 100) : 75;
    return await canvasToWebpViaWasm(canvas, wasmQuality);
  }
  
  // Standard path for other formats
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
            
            // Debug logging
            console.log('[ImageConverter] Converting with settings:', {
              displayedPercentage: qualitySettings.percentage,
              internalQuality: quality,
              outputFormat,
              isSafariBrowser: isSafari(),
              canvasSize: `${canvas.width}x${canvas.height}`
            });
            
            try {
              const blob = await canvasToBlobWithQuality(canvas, outputFormat, quality);
              console.log('[ImageConverter] Conversion result:', {
                blobSize: blob.size,
                blobType: blob.type,
                expectedFormat: outputFormat
              });
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
                    canvas.toBlob((blob) => res(blob), 'image/png');
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
