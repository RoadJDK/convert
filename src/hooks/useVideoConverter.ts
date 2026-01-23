import { useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
      onProgress: (progress: number) => void
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

      await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libvpx',
        '-crf', '30',
        '-b:v', '0',
        '-c:a', 'libvorbis',
        '-q:a', '4',
        outputName,
      ]);

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
