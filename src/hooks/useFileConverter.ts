import { useState, useCallback } from 'react';
import { ConvertibleFile, getFileType, getOutputExtension } from '@/types/converter';
import { useImageConverter } from './useImageConverter';
import { useVideoConverter } from './useVideoConverter';

export const useFileConverter = () => {
  const [files, setFiles] = useState<ConvertibleFile[]>([]);
  const { convertToWebP } = useImageConverter();
  const { convertToWebM } = useVideoConverter();

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

  const convertFile = useCallback(
    async (fileItem: ConvertibleFile) => {
      updateFile(fileItem.id, { status: 'converting', progress: 0 });

      try {
        const onProgress = (progress: number) => {
          updateFile(fileItem.id, { progress });
        };

        let result: { blob: Blob; url: string };

        if (fileItem.type === 'image') {
          result = await convertToWebP(fileItem.file, onProgress);
        } else {
          result = await convertToWebM(fileItem.file, onProgress);
        }

        updateFile(fileItem.id, {
          status: 'completed',
          progress: 100,
          convertedBlob: result.blob,
          convertedUrl: result.url,
        });
      } catch (error) {
        updateFile(fileItem.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Conversion failed',
        });
      }
    },
    [convertToWebP, convertToWebM, updateFile]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.convertedUrl) {
        URL.revokeObjectURL(file.convertedUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const downloadFile = useCallback((fileItem: ConvertibleFile, customName?: string) => {
    if (!fileItem.convertedUrl) return;

    const extension = getOutputExtension(fileItem.type);
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
    addFiles,
    convertFile,
    removeFile,
    downloadFile,
    updateFileName,
  };
};
