import { useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { QualitySettings, CropArea } from '@/types/converter';

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
}

export const useVideoConverter = () => {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadedRef = useRef(false);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current && ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loadedRef.current = true;
    return ffmpeg;
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

      const { qualitySettings, cropArea, dimensions } = options;

      // Build FFmpeg arguments
      const args: string[] = ['-i', inputName];

      // Build filter complex for crop and scale
      const filters: string[] = [];

      if (cropArea) {
        filters.push(`crop=${cropArea.width}:${cropArea.height}:${cropArea.x}:${cropArea.y}`);
      }

      if (dimensions) {
        filters.push(`scale=${dimensions.width}:${dimensions.height}`);
      }

      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }

      // Quality settings
      if (qualitySettings.mode === 'percentage') {
        // Map percentage to CRF (lower CRF = better quality)
        // 100% -> CRF 10, 10% -> CRF 50
        const crf = Math.round(50 - (qualitySettings.percentage / 100) * 40);
        args.push('-c:v', 'libvpx', '-crf', crf.toString(), '-b:v', '0');
      } else {
        // Target bitrate based on max size
        // Estimate: target_bitrate = (target_size_kb * 8) / duration_seconds
        // We'll use a rough estimate assuming 30 seconds
        const targetBitrate = Math.round((qualitySettings.maxSizeKB * 8) / 30);
        args.push('-c:v', 'libvpx', '-b:v', `${targetBitrate}k`);
      }

      args.push('-c:a', 'libvorbis', '-q:a', '4', outputName);

      await ffmpeg.exec(args);

      onProgress(95);

      const data = await ffmpeg.readFile(outputName);
      const uint8Array = new Uint8Array(data as Uint8Array);
      const blob = new Blob([uint8Array], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      // Cleanup
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      onProgress(100);

      return { blob, url };
    },
    [loadFFmpeg]
  );

  return { convertToWebM };
};
