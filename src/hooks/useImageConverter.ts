import { useCallback } from 'react';
import { QualitySettings, CropArea, displayedToInternalQuality, getOutputMimeType, ImageOutputFormat } from '@/types/converter';
import { encode as encodeWebp } from '@jsquash/webp';
import { optimise as optimisePng } from '@jsquash/oxipng';

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

// Optimise PNG using OxiPNG WASM (lossless optimization)
const optimisePngBuffer = async (pngBuffer: ArrayBuffer): Promise<ArrayBuffer> => {
  try {
    // Level 2 is a good balance between speed and compression
    return await optimisePng(pngBuffer, { level: 2 });
  } catch (e) {
    console.warn('[ImageConverter] OxiPNG optimization failed, using original:', e);
    return pngBuffer;
  }
};

// Convert canvas to PNG ArrayBuffer
const canvasToPngBuffer = (canvas: HTMLCanvasElement): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          resolve(await blob.arrayBuffer());
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      },
      'image/png'
    );
  });
};

// Quality mapping for JPEG: more aggressive compression at low percentages
// 50% displayed -> 0.15 quality (very compressed, ~20-30% of original)
// 100% displayed -> 0.70 quality (good balance, ~80-100% of original)  
// 200% displayed -> 0.95 quality (near-lossless, can be larger than original)
const displayedToJpegQuality = (displayed: number): number => {
  // Use a curve that's more aggressive at low values
  // 50 -> 0.15, 100 -> 0.70, 200 -> 0.95
  if (displayed <= 100) {
    // 50-100: map to 0.15-0.70 (linear)
    return 0.15 + ((displayed - 50) / 50) * 0.55;
  } else {
    // 100-200: map to 0.70-0.95 (linear)
    return 0.70 + ((displayed - 100) / 100) * 0.25;
  }
};

// Quality mapping for WebP: similar to JPEG but slightly better compression
// 50% displayed -> 0.10 quality
// 100% displayed -> 0.65 quality
// 200% displayed -> 0.92 quality
const displayedToWebpQuality = (displayed: number): number => {
  if (displayed <= 100) {
    return 0.10 + ((displayed - 50) / 50) * 0.55;
  } else {
    return 0.65 + ((displayed - 100) / 100) * 0.27;
  }
};

// Convert canvas to blob with format-specific quality handling
const canvasToBlobWithQuality = async (
  canvas: HTMLCanvasElement,
  targetFormat: ImageOutputFormat,
  quality: number | undefined
): Promise<Blob> => {
  const mimeType = getOutputMimeType('image', targetFormat);
  
  // WebP: try native first, then WASM fallback
  if (targetFormat === 'webp') {
    const nativeBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
    });
    
    // Check if we actually got WebP (Safari often returns PNG instead)
    if (nativeBlob && nativeBlob.type === 'image/webp') {
      return nativeBlob;
    }
    
    // Fallback to WASM encoder for Safari
    console.log('[ImageConverter] Native WebP failed, using WASM encoder');
    const wasmQuality = quality !== undefined ? Math.round(quality * 100) : 75;
    return await canvasToWebpViaWasm(canvas, wasmQuality);
  }
  
  // PNG: Use canvas.toBlob then optimize with OxiPNG
  if (targetFormat === 'png') {
    const pngBuffer = await canvasToPngBuffer(canvas);
    const optimizedBuffer = await optimisePngBuffer(pngBuffer);
    return new Blob([optimizedBuffer], { type: 'image/png' });
  }
  
  // Standard path for JPEG and other formats
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

// Scale canvas down by a factor and return new canvas
const scaleCanvas = (
  sourceCanvas: HTMLCanvasElement, 
  scaleFactor: number
): HTMLCanvasElement => {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scaleFactor));
  newCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scaleFactor));
  
  const ctx = newCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, newCanvas.width, newCanvas.height);
  
  return newCanvas;
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
          const outputFormat = (qualitySettings.outputFormat as ImageOutputFormat) || 'webp';

          // Calculate source dimensions (for cropping)
          const sx = cropArea?.x ?? 0;
          const sy = cropArea?.y ?? 0;
          const sWidth = cropArea?.width ?? img.width;
          const sHeight = cropArea?.height ?? img.height;

          // Calculate final dimensions with scale
          let targetWidth = cropArea ? cropArea.width : img.width;
          let targetHeight = cropArea ? cropArea.height : img.height;

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

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Add white background if needed
          if (addWhiteBackground) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          onProgress(60);

          try {
            let blob: Blob;

            if (qualitySettings.mode === 'percentage') {
              // Percentage mode: use format-specific quality mapping
              let quality: number | undefined;
              
              if (outputFormat === 'png') {
                // PNG is lossless, quality doesn't apply
                // But we can scale down to simulate "quality reduction"
                const displayedPct = qualitySettings.percentage;
                
                if (displayedPct < 100) {
                  // Scale down proportionally: 50% = 50% of dimensions
                  const scaleFactor = displayedPct / 100;
                  const scaledCanvas = scaleCanvas(canvas, scaleFactor);
                  blob = await canvasToBlobWithQuality(scaledCanvas, outputFormat, undefined);
                } else {
                  // 100%+ = full size
                  blob = await canvasToBlobWithQuality(canvas, outputFormat, undefined);
                }
              } else if (outputFormat === 'jpeg') {
                quality = displayedToJpegQuality(qualitySettings.percentage);
                console.log('[ImageConverter] JPEG quality:', qualitySettings.percentage, '% ->', quality);
                blob = await canvasToBlobWithQuality(canvas, outputFormat, quality);
              } else if (outputFormat === 'webp') {
                quality = displayedToWebpQuality(qualitySettings.percentage);
                console.log('[ImageConverter] WebP quality:', qualitySettings.percentage, '% ->', quality);
                blob = await canvasToBlobWithQuality(canvas, outputFormat, quality);
              } else {
                // AVIF, GIF, BMP - use generic mapping
                quality = displayedToInternalQuality(qualitySettings.percentage);
                blob = await canvasToBlobWithQuality(canvas, outputFormat, quality);
              }
              
              console.log('[ImageConverter] Result:', {
                format: outputFormat,
                size: blob.size,
                type: blob.type
              });
              
              onProgress(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
              
            } else {
              // MaxSize mode: binary search to find quality that fits
              const targetBytes = qualitySettings.maxSizeKB * 1024;
              
              if (outputFormat === 'png') {
                // PNG: scale down iteratively until under target
                let currentCanvas = canvas;
                let scaleFactor = 1.0;
                let bestBlob: Blob | null = null;
                let iterations = 0;
                const maxIterations = 10;
                
                while (iterations < maxIterations) {
                  const pngBuffer = await canvasToPngBuffer(currentCanvas);
                  const optimizedBuffer = await optimisePngBuffer(pngBuffer);
                  const testBlob = new Blob([optimizedBuffer], { type: 'image/png' });
                  
                  console.log('[ImageConverter] PNG MaxSize iteration:', {
                    iteration: iterations,
                    scaleFactor,
                    size: testBlob.size,
                    target: targetBytes
                  });
                  
                  if (testBlob.size <= targetBytes) {
                    bestBlob = testBlob;
                    break;
                  }
                  
                  // Calculate new scale factor based on size ratio
                  // Be more aggressive: aim for 80% of target
                  const sizeRatio = (targetBytes * 0.8) / testBlob.size;
                  // For PNG, size scales roughly with pixel count (width * height)
                  // So we need sqrt of the ratio for dimension scale
                  const dimensionRatio = Math.sqrt(sizeRatio);
                  scaleFactor *= dimensionRatio;
                  
                  // Minimum scale to prevent infinite loop
                  if (scaleFactor < 0.1) {
                    console.warn('[ImageConverter] PNG cannot reach target size, using smallest');
                    bestBlob = testBlob;
                    break;
                  }
                  
                  currentCanvas = scaleCanvas(canvas, scaleFactor);
                  iterations++;
                }
                
                if (!bestBlob) {
                  bestBlob = await canvasToBlobWithQuality(canvas, outputFormat, undefined);
                }
                
                blob = bestBlob;
              } else {
                // JPEG/WebP: binary search on quality
                let minQ = 0.01;
                let maxQ = 0.95;
                let bestBlob: Blob | null = null;
                let iterations = 0;
                const maxIterations = 10;

                while (iterations < maxIterations && (maxQ - minQ) > 0.02) {
                  const midQ = (minQ + maxQ) / 2;
                  
                  let testBlob: Blob;
                  if (outputFormat === 'webp') {
                    // Use WASM for consistent results
                    testBlob = await canvasToWebpViaWasm(canvas, Math.round(midQ * 100));
                  } else {
                    testBlob = await canvasToBlobWithQuality(canvas, outputFormat, midQ);
                  }
                  
                  console.log('[ImageConverter] MaxSize binary search:', {
                    iteration: iterations,
                    quality: midQ,
                    size: testBlob.size,
                    target: targetBytes
                  });

                  if (testBlob.size <= targetBytes) {
                    bestBlob = testBlob;
                    minQ = midQ; // Try higher quality
                  } else {
                    maxQ = midQ; // Need lower quality
                  }

                  iterations++;
                  onProgress(70 + (iterations / maxIterations) * 25);
                }

                // Final check: if best is still over, try minimum quality
                if (!bestBlob || bestBlob.size > targetBytes) {
                  let finalBlob: Blob;
                  if (outputFormat === 'webp') {
                    finalBlob = await canvasToWebpViaWasm(canvas, 1);
                  } else {
                    finalBlob = await canvasToBlobWithQuality(canvas, outputFormat, 0.01);
                  }
                  
                  if (finalBlob.size <= targetBytes || !bestBlob) {
                    bestBlob = finalBlob;
                  }
                }

                blob = bestBlob!;
              }
              
              console.log('[ImageConverter] MaxSize result:', {
                format: outputFormat,
                size: blob.size,
                target: targetBytes,
                underLimit: blob.size <= targetBytes
              });

              onProgress(100);
              const url = URL.createObjectURL(blob);
              resolve({ blob, url });
            }
          } catch (err) {
            reject(err);
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
