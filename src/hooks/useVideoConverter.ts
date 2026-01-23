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

      if (outputFormat === 'gif') {
        throw new Error('GIF-Export für Videos wird aktuell nicht unterstützt.');
      }

      const container = outputFormat === 'mp4' ? 'mp4' : 'webm';

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
              return { type: 'reencode', videoCodec, resize: null, rotate: 0 };
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

      const outputFormat = (options.qualitySettings.outputFormat || 'webm') as VideoOutputFormat;

      if (outputFormat === 'gif') {
        throw new Error('GIF-Export für Videos wird aktuell nicht unterstützt.');
      }

      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        const fileUrl = URL.createObjectURL(file);
        video.src = fileUrl;

        video.onloadedmetadata = async () => {
          const { cropArea, dimensions, trimRange } = options;

          const startTime = Math.max(0, trimRange?.start ?? 0);
          const endTime = Math.max(startTime, trimRange?.end ?? video.duration);

          const sx = cropArea?.x ?? 0;
          const sy = cropArea?.y ?? 0;
          const sWidth = cropArea?.width ?? video.videoWidth;
          const sHeight = cropArea?.height ?? video.videoHeight;

          let targetWidth = cropArea ? cropArea.width : video.videoWidth;
          let targetHeight = cropArea ? cropArea.height : video.videoHeight;

          if (dimensions) {
            targetWidth = dimensions.width;
            targetHeight = dimensions.height;
          }

          const scale = (options.qualitySettings.scale ?? 100) / 100;
          targetWidth = Math.max(2, Math.round(targetWidth * scale));
          targetHeight = Math.max(2, Math.round(targetHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
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
            // Do NOT connect to destination to avoid audible playback.
            
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
            (async () => {
              URL.revokeObjectURL(fileUrl);

              let blob = new Blob(chunks, { type: mimeType!.split(';')[0] });

              if (!blob || blob.size === 0) {
                reject(new Error('Video conversion produced empty file'));
                return;
              }

              // If the browser could not record in the requested container, remux/transcode to match selection.
              const targetContainer = outputFormat === 'mp4' ? 'mp4' : 'webm';
              const targetMime = outputFormat === 'mp4' ? 'video/mp4' : 'video/webm';

              if (blob.type !== targetMime) {
                onProgress(95);
                const remux = await convertMedia({
                  src: blob,
                  container: targetContainer,
                  videoCodec: targetContainer === 'mp4' ? 'h264' : 'vp8',
                  audioCodec: targetContainer === 'mp4' ? 'aac' : 'opus',
                });
                blob = await remux.save();
              }

              console.log('[VideoConverter] MediaRecorder complete:', {
                blobSize: blob.size,
                blobType: blob.type,
              });

              const url = URL.createObjectURL(blob);
              onProgress(100);
              resolve({ blob, url });
            })().catch((err) => {
              reject(err);
            });
          };

          recorder.onerror = (event) => {
            URL.revokeObjectURL(fileUrl);
            console.error('[VideoConverter] MediaRecorder error:', event);
            reject(new Error('MediaRecorder error'));
          };

          const startRecording = async () => {
            // Request data frequently for better reliability
            recorder.start(100); // Request data every 100ms
            onProgress(20);

            await video.play();

            const total = Math.max(0.1, endTime - startTime);

            const drawFrame = () => {
              if (video.ended || video.paused) {
                recorder.stop();
                return;
              }

              // Stop at trim end
              if (video.currentTime >= endTime - 0.01) {
                video.pause();
                recorder.stop();
                return;
              }

              ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
              const rel = Math.max(0, Math.min(1, (video.currentTime - startTime) / total));
              onProgress(20 + rel * 75);
              requestAnimationFrame(drawFrame);
            };

            drawFrame();

            video.onended = () => {
              setTimeout(() => recorder.stop(), 100); // Small delay to ensure last frame
            };
          };

          // Seek to trim start before starting recording
          const safeStart = Math.min(Math.max(0, startTime), Math.max(0, video.duration - 0.05));
          if (safeStart > 0) {
            video.currentTime = safeStart;
            video.onseeked = () => {
              video.onseeked = null;
              startRecording().catch(reject);
            };
          } else {
            video.currentTime = 0;
            startRecording().catch(reject);
          }
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

      const hasEdits = Boolean(options.cropArea || options.dimensions || options.trimRange);

      // If there are crop/trim edits, prefer the MediaRecorder pipeline because it can apply them reliably.
      if (hasEdits) {
        console.log('[VideoConverter] Using MediaRecorder (edits detected)');
        return await convertWithMediaRecorder(file, onProgress, options);
      }

      // Try WebCodecs first (best quality)
      if (isWebCodecsSupported()) {
        try {
          console.log('[VideoConverter] Using WebCodecs API');
          return await convertWithWebCodecs(file, onProgress, options);
        } catch (webCodecsError) {
          console.warn('[VideoConverter] WebCodecs failed, trying fallback:', webCodecsError);
        }
      }

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
        video.preload = 'auto'; // Changed from 'metadata' for Safari compatibility
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        
        // Safari needs autoplay to load video data
        video.autoplay = false;

        const url = URL.createObjectURL(file);
        
        const cleanup = () => {
          URL.revokeObjectURL(url);
          video.src = '';
          video.load();
        };
        
        const captureFrame = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              cleanup();
              reject(new Error('Could not get canvas context'));
              return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frameDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            cleanup();
            resolve(frameDataUrl);
          } catch (err) {
            console.error('[extractFrame] Canvas error:', err);
            cleanup();
            reject(err);
          }
        };

        let hasResolved = false;
        
        video.onloadeddata = () => {
          if (hasResolved) return;
          
          // For first frame (timeSeconds = 0), capture immediately
          if (timeSeconds === 0) {
            hasResolved = true;
            // Small delay for Safari to fully decode
            setTimeout(captureFrame, 100);
          } else {
            video.currentTime = Math.min(timeSeconds, video.duration || 0);
          }
        };

        video.onseeked = () => {
          if (hasResolved) return;
          hasResolved = true;
          setTimeout(captureFrame, 50);
        };
        
        video.onerror = (e) => {
          console.error('[extractFrame] Video error:', e);
          cleanup();
          // Don't reject - just return a placeholder
          resolve('');
        };

        // Timeout fallback
        setTimeout(() => {
          if (!hasResolved) {
            console.warn('[extractFrame] Timeout - using fallback');
            hasResolved = true;
            cleanup();
            resolve(''); // Return empty string as fallback
          }
        }, 5000);

        video.src = url;
        video.load();
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