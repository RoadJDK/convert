import { useCallback, useRef } from 'react';
import { convertMedia, webcodecsController, canReencodeVideoTrack, canReencodeAudioTrack } from '@remotion/webcodecs';
import { QualitySettings, CropArea, TrimRange, VideoOutputFormat } from '@/types/converter';

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
}

// Detect Safari/WebKit
const isSafari = () => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

// Check if WebCodecs API is available (required for @remotion/webcodecs)
const isWebCodecsSupported = () => {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
};

export const useVideoConverter = () => {
  const controllerRef = useRef<ReturnType<typeof webcodecsController> | null>(null);

  /**
   * Primary conversion method using @remotion/webcodecs (native WebCodecs API)
   */
  const convertWithWebCodecs = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      onProgress(5);

      // Abort any previous conversion
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      controllerRef.current = webcodecsController();

      // Determine output format based on settings
      const outputFormat = (options.qualitySettings.outputFormat || 'webm') as VideoOutputFormat;
      
      // For Safari, prefer MP4 with H.264 for better compatibility
      const useSafariCompat = isSafari() && outputFormat === 'webm';
      const container = useSafariCompat ? 'mp4' : (outputFormat === 'mp4' ? 'mp4' : 'webm');
      
      // Select codecs based on container
      const videoCodec = container === 'mp4' ? 'h264' : 'vp8';
      const audioCodec = container === 'mp4' ? 'aac' : 'opus';

      console.log('[VideoConverter] Converting with WebCodecs:', {
        container,
        videoCodec,
        audioCodec,
        isSafari: isSafari(),
      });

      try {
        const result = await convertMedia({
          src: file,
          container,
          videoCodec,
          audioCodec,
          controller: controllerRef.current,
          onProgress: ({ overallProgress }) => {
            if (overallProgress !== null) {
              onProgress(5 + overallProgress * 90);
            }
          },
          onVideoTrack: async ({ track }) => {
            const canReencode = await canReencodeVideoTrack({
              track,
              videoCodec,
              resizeOperation: null,
              rotate: 0,
            });
            if (canReencode) {
              return { type: 'reencode', videoCodec, resizeOperation: null, rotate: 0 };
            }
            // If we can't re-encode, try to copy the track
            return { type: 'copy' };
          },
          onAudioTrack: async ({ track }) => {
            const canReencode = await canReencodeAudioTrack({
              track,
              audioCodec,
              bitrate: 128000,
              sampleRate: null,
            });
            if (canReencode) {
              return { type: 'reencode', audioCodec, bitrate: 128000, sampleRate: null };
            }
            // If we can't re-encode, try to copy the track
            return { type: 'copy' };
          },
        });

        onProgress(95);

        const blob = await result.save();
        
        // Validate the blob
        if (!blob || blob.size === 0) {
          throw new Error('Converted video blob is empty');
        }

        console.log('[VideoConverter] Conversion complete:', {
          blobSize: blob.size,
          blobType: blob.type,
        });

        const url = URL.createObjectURL(blob);

        onProgress(100);

        return { blob, url };
      } catch (error) {
        console.error('WebCodecs conversion error:', error);
        throw error;
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
      options: ConversionOptions
    ): Promise<{ blob: Blob; url: string }> => {
      onProgress(5);

      const outputFormat = options.qualitySettings.outputFormat || 'webm';

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

          // Determine best MIME type for the target format
          let mimeType: string | null = null;
          
          if (outputFormat === 'mp4') {
            // Safari/iOS needs mp4
            if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
              mimeType = 'video/mp4;codecs=avc1';
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
              mimeType = 'video/mp4';
            }
          }
          
          if (!mimeType) {
            // Fallback to webm
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
              mimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
              mimeType = 'video/webm;codecs=vp8';
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
              mimeType = 'video/webm';
            }
          }

          if (!mimeType) {
            URL.revokeObjectURL(fileUrl);
            reject(new Error('Kein unterstütztes Video-Format gefunden'));
            return;
          }

          console.log('[VideoConverter] MediaRecorder using MIME type:', mimeType);

          const stream = canvas.captureStream(30);
          
          // Try to capture audio from original video
          try {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            source.connect(audioCtx.destination);
            
            dest.stream.getAudioTracks().forEach(track => {
              stream.addTrack(track);
            });
          } catch {
            console.log('[VideoConverter] Could not capture audio track');
          }

          const recorder = new MediaRecorder(stream, { 
            mimeType,
            videoBitsPerSecond: 2500000, // 2.5 Mbps
          });
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            URL.revokeObjectURL(fileUrl);
            
            const blob = new Blob(chunks, { type: mimeType!.split(';')[0] });
            
            if (blob.size === 0) {
              reject(new Error('Video conversion produced empty file'));
              return;
            }
            
            console.log('[VideoConverter] MediaRecorder complete:', {
              blobSize: blob.size,
              blobType: blob.type,
            });
            
            const url = URL.createObjectURL(blob);
            onProgress(100);
            resolve({ blob, url });
          };

          recorder.onerror = (event) => {
            URL.revokeObjectURL(fileUrl);
            console.error('[VideoConverter] MediaRecorder error:', event);
            reject(new Error('MediaRecorder error'));
          };

          // Start playback and recording
          video.currentTime = 0;
          await video.play();
          
          // Request data frequently for better reliability
          recorder.start(100); // Request data every 100ms
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
            setTimeout(() => recorder.stop(), 100); // Small delay to ensure last frame
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
        isSafari: isSafari(),
        fileName: file.name,
        fileSize: file.size,
        outputFormat: options.qualitySettings.outputFormat,
      });

      // Try WebCodecs first (best quality)
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