import { useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { QualitySettings, CropArea, TrimRange, displayedToInternalQuality } from '@/types/converter';

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
}

export const useVideoConverter = () => {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    // Use the official CDN with latest stable version (UMD build for better compatibility)
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

    // Helpful while debugging in-browser; harmless in prod.
    ffmpeg.on('log', ({ message }) => {
      // eslint-disable-next-line no-console
      console.log('[ffmpeg]', message);
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      loadedRef.current = true;
      return ffmpeg;
    } catch (loadError) {
      console.error('FFmpeg load error:', loadError);
      // Reset state so user can try again
      loadedRef.current = false;
      ffmpegRef.current = null;
      throw new Error('Video-Konvertierung nicht verfügbar. Versuche es mit einem Bild oder lade die Seite neu.');
    }
  }, []);

  const convertToWebM = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      onProgress(5);
      
      const ffmpeg = await loadFFmpeg();
      onProgress(15);

      const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
      const outputName = 'output.webm';

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      onProgress(30);

      ffmpeg.on('progress', ({ progress }) => {
        const adjustedProgress = 30 + progress * 60;
        onProgress(Math.min(adjustedProgress, 90));
      });

      const { qualitySettings, cropArea, dimensions, trimRange } = options;

      // Build FFmpeg arguments
      const args: string[] = [];

      // Trim settings: place -ss BEFORE -i for more reliable seeking in wasm.
      if (trimRange) {
        args.push('-ss', Math.max(0, trimRange.start).toString());
      }

      args.push('-i', inputName);

      // Duration (recommended vs -to in this context)
      if (trimRange) {
        const duration = Math.max(0, trimRange.end - trimRange.start);
        // Avoid 0-length encodes
        if (duration > 0.05) args.push('-t', duration.toString());
      }

      // Build filter complex for crop and scale
      const filters: string[] = [];

      if (cropArea) {
        // Many encoders require even dimensions.
        const w = Math.max(2, cropArea.width - (cropArea.width % 2));
        const h = Math.max(2, cropArea.height - (cropArea.height % 2));
        filters.push(`crop=${w}:${h}:${cropArea.x}:${cropArea.y}`);
      }

      // Apply scale factor
      const scale = qualitySettings.scale / 100;
      if (scale !== 1 || dimensions) {
        let targetWidth = dimensions?.width ?? -1;
        let targetHeight = dimensions?.height ?? -1;
        
       if (scale !== 1 && !dimensions) {
         // Keep even dimensions to avoid encoder failures.
         filters.push(
           `scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2`
         );
       } else if (dimensions) {
         const w = targetWidth > 0 ? targetWidth - (targetWidth % 2) : -1;
         const h = targetHeight > 0 ? targetHeight - (targetHeight % 2) : -1;
         filters.push(`scale=${w}:${h}`);
       }
      }

      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }

      // Quality settings - use VP8/Vorbis as default (more stable, avoids memory errors with VP9/Opus)
      if (qualitySettings.mode === 'percentage') {
        const internalQuality = displayedToInternalQuality(qualitySettings.percentage);
        // Map internal quality (50-100) to CRF for VP8 (range ~45..20)
        const crf = Math.round(45 - (internalQuality / 100) * 25);
        args.push('-c:v', 'libvpx', '-crf', crf.toString(), '-b:v', '1M');
      } else {
        const targetBitrate = Math.max(100, Math.round((qualitySettings.maxSizeKB * 8) / 30));
        args.push('-c:v', 'libvpx', '-b:v', `${targetBitrate}k`);
      }
      
      // Use vorbis audio codec (stable alternative to opus which causes memory errors)
      args.push('-c:a', 'libvorbis', '-b:a', '128k');
      
      // Output
      args.push(outputName);

      console.log('FFmpeg args:', args);

      try {
        await ffmpeg.exec(args);
      } catch (execError) {
        const msg = (execError as any)?.message ?? String(execError);
        console.error('FFmpeg exec error:', msg);
        throw new Error(`Video-Konvertierung fehlgeschlagen. Bitte versuche ein anderes Video oder Format.`);
      }

      onProgress(95);

      const data = await ffmpeg.readFile(outputName);
      const uint8Array = new Uint8Array(data as Uint8Array);
      const blob = new Blob([uint8Array], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      // Cleanup
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {
        // ignore
      }
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }

      onProgress(100);

      return { blob, url };
    },
    [loadFFmpeg]
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
  const getVideoDuration = useCallback(
    async (file: File): Promise<number> => {
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
    },
    []
  );

  return { convertToWebM, extractFrame, getVideoDuration };
};
