import { useCallback, useRef } from 'react';
import { convertMedia, webcodecsController } from '@remotion/webcodecs';
import { QualitySettings, CropArea, TrimRange } from '@/types/converter';

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
}

// Check if WebCodecs API is available (required for @remotion/webcodecs)
const isWebCodecsSupported = () => {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
};

export const useVideoConverter = () => {
  const controllerRef = useRef<ReturnType<typeof webcodecsController> | null>(null);

  /**
   * Primary conversion method using @remotion/webcodecs (native WebCodecs API)
   * Works better on Safari than FFmpeg.wasm
   */
  const convertWithWebCodecs = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      _options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      onProgress(5);

      // Abort any previous conversion
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      controllerRef.current = webcodecsController();

      try {
        const result = await convertMedia({
          src: file,
          container: 'webm',
          videoCodec: 'vp8', // VP8 has better browser support than VP9
          audioCodec: 'opus',
          controller: controllerRef.current,
          onProgress: ({ overallProgress }) => {
            if (overallProgress !== null) {
              onProgress(5 + overallProgress * 90);
            }
          },
        });

        onProgress(95);

        const blob = await result.save();
        const url = URL.createObjectURL(blob);

        onProgress(100);

        return { blob, url };
      } catch (error) {
        console.error('WebCodecs conversion error:', error);
        throw new Error('Video-Konvertierung fehlgeschlagen. Bitte versuche ein anderes Video.');
      }
    },
    []
  );

  /**
   * Fallback: Simple re-encoding using Canvas + MediaRecorder
   * Works on browsers without WebCodecs support
   */
  const convertWithMediaRecorder = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      _options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      onProgress(5);

      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        const fileUrl = URL.createObjectURL(file);
        video.src = fileUrl;

        video.onloadedmetadata = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            URL.revokeObjectURL(fileUrl);
            reject(new Error('Canvas context not available'));
            return;
          }

          // Check for supported MIME types
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : null;

          if (!mimeType) {
            URL.revokeObjectURL(fileUrl);
            reject(new Error('Kein unterstütztes Video-Format gefunden'));
            return;
          }

          const stream = canvas.captureStream(30);
          const recorder = new MediaRecorder(stream, { mimeType });
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            URL.revokeObjectURL(fileUrl);
            const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
            const url = URL.createObjectURL(blob);
            onProgress(100);
            resolve({ blob, url });
          };

          recorder.onerror = () => {
            URL.revokeObjectURL(fileUrl);
            reject(new Error('MediaRecorder error'));
          };

          video.play();
          recorder.start();
          onProgress(20);

          const drawFrame = () => {
            if (video.ended || video.paused) {
              recorder.stop();
              return;
            }
            ctx.drawImage(video, 0, 0);
            onProgress(20 + (video.currentTime / video.duration) * 75);
            requestAnimationFrame(drawFrame);
          };

          drawFrame();

          video.onended = () => {
            recorder.stop();
          };
        };

        video.onerror = () => {
          URL.revokeObjectURL(fileUrl);
          reject(new Error('Failed to load video'));
        };
      });
    },
    []
  );

  /**
   * Main conversion function - uses WebCodecs if available, falls back to MediaRecorder
   */
  const convertToWebM = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      console.log('[VideoConverter] Starting conversion...', {
        webCodecsSupported: isWebCodecsSupported(),
        fileName: file.name,
        fileSize: file.size,
      });

      // Try WebCodecs first (best quality and Safari support)
      if (isWebCodecsSupported()) {
        try {
          console.log('[VideoConverter] Using WebCodecs API');
          return await convertWithWebCodecs(file, onProgress, options);
        } catch (webCodecsError) {
          console.warn('[VideoConverter] WebCodecs failed, trying fallback:', webCodecsError);
        }
      }

      // Fallback to MediaRecorder
      console.log('[VideoConverter] Using MediaRecorder fallback');
      return await convertWithMediaRecorder(file, onProgress, options);
    },
    [convertWithWebCodecs, convertWithMediaRecorder]
  );

  // Extract first frame as preview
  const extractFrame = useCallback(
    async (file: File, timeSeconds: number = 0): Promise<string> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(timeSeconds, video.duration);
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(video, 0, 0);
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);

          URL.revokeObjectURL(url);
          resolve(frameDataUrl);
        };

        video.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load video'));
        };
      });
    },
    []
  );

  // Get video duration
  const getVideoDuration = useCallback(async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };
    });
  }, []);

  return { convertToWebM, extractFrame, getVideoDuration };
};
