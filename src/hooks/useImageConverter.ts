import { useCallback } from 'react';

interface ConversionResult {
  blob: Blob;
  url: string;
}

export const useImageConverter = () => {
  const convertToWebP = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void
    ): Promise<ConversionResult> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          onProgress(30);
          img.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        img.onload = () => {
          onProgress(60);
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);
          onProgress(80);

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
            'image/webp',
            0.9
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        reader.readAsDataURL(file);
      });
    },
    []
  );

  return { convertToWebP };
};
