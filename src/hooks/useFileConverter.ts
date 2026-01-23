import { useState, useCallback, useEffect, useRef } from 'react';
import { ConvertibleFile, getFileType, getOutputExtension, QualitySettings, CropArea, TrimRange, DEFAULT_QUALITY_SETTINGS, ImageOutputFormat } from '@/types/converter';
import { useImageConverter } from './useImageConverter';
import { useVideoConverter } from './useVideoConverter';
import { useStatsTracker } from './useStatsTracker';
import { removeBackground, Config } from '@imgly/background-removal';
import { toast } from 'sonner';

// Rate limiting: 30 conversions per minute
const RATE_LIMIT_CONVERSIONS_PER_MINUTE = 30;

export const useFileConverter = () => {
  const [files, setFiles] = useState<ConvertibleFile[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<Record<string, string>>({});
  const conversionTimestamps = useRef<number[]>([]);
  const { convertImage, convertToWebP } = useImageConverter();
  const { convertToWebM, extractFrame } = useVideoConverter();
  const { trackConversion } = useStatsTracker();

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    conversionTimestamps.current = conversionTimestamps.current.filter(t => t > oneMinuteAgo);
    
    if (conversionTimestamps.current.length >= RATE_LIMIT_CONVERSIONS_PER_MINUTE) {
      const oldestTimestamp = conversionTimestamps.current[0];
      const waitTime = Math.ceil((oldestTimestamp + 60000 - now) / 1000);
      toast.error(`Rate limit erreicht. Bitte warte ${waitTime} Sekunden.`);
      return false;
    }
    
    conversionTimestamps.current.push(now);
    return true;
  }, []);

  // Extract video previews
  useEffect(() => {
    const extractPreviews = async () => {
      for (const file of files) {
        if (file.type === 'video' && !videoPreviews[file.id]) {
          try {
            const preview = await extractFrame(file.file, 0);
            setVideoPreviews(prev => ({ ...prev, [file.id]: preview }));
          } catch (e) {
            console.error('Failed to extract video frame:', e);
          }
        }
      }
    };
    extractPreviews();
  }, [files, extractFrame, videoPreviews]);

  const addFiles = useCallback((newFiles: File[]) => {
    const convertibleFiles: ConvertibleFile[] = newFiles
      .map((file) => {
        const type = getFileType(file);
        if (!type) return null;

        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          type,
          status: 'pending' as const,
          progress: 0,
          originalName: file.name,
          qualitySettings: { ...DEFAULT_QUALITY_SETTINGS },
          originalSize: file.size,
        };
      })
      .filter(Boolean) as ConvertibleFile[];

    setFiles((prev) => [...prev, ...convertibleFiles]);
    return convertibleFiles;
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<ConvertibleFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  // Replace a file with a new file (e.g., after background removal)
  const replaceFileWithNew = useCallback((id: string, newFile: File) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          // Revoke old URL if exists
          if (f.convertedUrl) {
            URL.revokeObjectURL(f.convertedUrl);
          }
          return {
            ...f,
            file: newFile,
            originalName: newFile.name,
            originalSize: newFile.size,
            status: 'pending' as const,
            progress: 0,
            convertedBlob: undefined,
            convertedUrl: undefined,
            convertedSize: undefined,
            error: undefined,
          };
        }
        return f;
      })
    );
  }, []);

  const updateFileSettings = useCallback((id: string, qualitySettings: QualitySettings) => {
    updateFile(id, { qualitySettings });
  }, [updateFile]);

  const updateFileCrop = useCallback((
    id: string, 
    cropArea: CropArea | undefined, 
    dimensions?: { width: number; height: number },
    trimRange?: TrimRange
  ) => {
    const updates: Partial<ConvertibleFile> = { cropArea, trimRange };
    if (dimensions) {
      (updates as any).dimensions = dimensions;
    }
    updateFile(id, updates);
  }, [updateFile]);

  const updateBulkSettings = useCallback((fileIds: string[], updates: Partial<{ qualitySettings: QualitySettings }>) => {
    setFiles((prev) =>
      prev.map((f) => 
        fileIds.includes(f.id) 
          ? { ...f, ...updates }
          : f
      )
    );
  }, []);

  const convertFile = useCallback(
    async (fileItem: ConvertibleFile) => {
      // Check rate limit before starting conversion
      if (!checkRateLimit()) {
        updateFile(fileItem.id, { status: 'error', error: 'Rate limit erreicht. Bitte warte etwas.' });
        return;
      }

      updateFile(fileItem.id, { status: 'converting', progress: 0 });

      try {
        let fileToConvert = fileItem.file;

        // Step 1: Background removal if enabled (images only)
        if (fileItem.type === 'image' && fileItem.removeBackground) {
          updateFile(fileItem.id, { progress: 5 });
          
          const config: Config = {
            publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.5.3/dist/',
            progress: (_key: string, current: number, total: number) => {
              const bgProgress = Math.round((current / total) * 40); // 0-40% for BG removal
              updateFile(fileItem.id, { progress: 5 + bgProgress });
            },
            output: {
              format: 'image/png',
              quality: 1.0
            }
          };

          const bgBlob = await removeBackground(fileToConvert, config);
          fileToConvert = new File([bgBlob], fileItem.file.name, { type: 'image/png' });
        }

        const onProgress = (progress: number) => {
          // If BG removal was done, map 0-100 to 45-100
          const adjustedProgress = fileItem.removeBackground 
            ? 45 + (progress * 0.55)
            : progress;
          updateFile(fileItem.id, { progress: adjustedProgress });
        };

        const options = {
          qualitySettings: fileItem.qualitySettings,
          cropArea: fileItem.cropArea,
          dimensions: (fileItem as any).dimensions,
          trimRange: fileItem.trimRange,
        };

        // For images with background removal to non-transparent format, add white background
        if (fileItem.type === 'image' && fileItem.removeBackground) {
          const format = fileItem.qualitySettings.outputFormat as ImageOutputFormat | undefined;
          if (format === 'jpeg' || format === 'bmp') {
            // Add white background option - will be handled in image converter
            (options as any).addWhiteBackground = true;
          }
        }

        let result: { blob: Blob; url: string };

        if (fileItem.type === 'image') {
          result = await convertImage(fileToConvert, onProgress, options);
        } else {
          result = await convertToWebM(fileItem.file, onProgress, options);
        }

        updateFile(fileItem.id, {
          status: 'completed',
          progress: 100,
          convertedBlob: result.blob,
          convertedUrl: result.url,
          convertedSize: result.blob.size,
        });

        // Track conversion in stats
        trackConversion(fileItem.type);
      } catch (error) {
        console.error('Conversion failed:', error);
        updateFile(fileItem.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Conversion failed',
        });
      }
    },
    [convertImage, convertToWebM, updateFile, trackConversion, checkRateLimit]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.convertedUrl) {
        URL.revokeObjectURL(file.convertedUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
    setVideoPreviews(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Reset a file to pending state (as if freshly uploaded)
  const resetFile = useCallback((id: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          // Revoke old URL if exists
          if (f.convertedUrl) {
            URL.revokeObjectURL(f.convertedUrl);
          }
          // Reset to fresh state
          return {
            ...f,
            status: 'pending' as const,
            progress: 0,
            convertedBlob: undefined,
            convertedUrl: undefined,
            convertedSize: undefined,
            error: undefined,
            qualitySettings: { ...DEFAULT_QUALITY_SETTINGS },
            cropArea: undefined,
            trimRange: undefined,
            suggestedName: undefined,
          };
        }
        return f;
      })
    );
  }, []);

  const clearAllFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((file) => {
        if (file.convertedUrl) {
          URL.revokeObjectURL(file.convertedUrl);
        }
      });
      return [];
    });
    setVideoPreviews({});
  }, []);

  const downloadFile = useCallback((fileItem: ConvertibleFile, customName?: string) => {
    if (!fileItem.convertedUrl) return;

    const extension = getOutputExtension(fileItem.type, fileItem.qualitySettings.outputFormat);
    const baseName = customName || fileItem.suggestedName || fileItem.originalName.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}.${extension}`;

    const a = document.createElement('a');
    a.href = fileItem.convertedUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const updateFileName = useCallback((id: string, newName: string) => {
    updateFile(id, { suggestedName: newName });
  }, [updateFile]);

  return {
    files,
    videoPreviews,
    addFiles,
    convertFile,
    removeFile,
    resetFile,
    clearAllFiles,
    downloadFile,
    updateFileName,
    updateFileSettings,
    updateFileCrop,
    updateBulkSettings,
    updateFile,
  };
};
