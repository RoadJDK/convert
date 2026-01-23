import { useState, useCallback, useRef } from 'react';
import { removeBackground, Config } from '@imgly/background-removal';
import { toast } from 'sonner';

interface RemovalState {
  [fileId: string]: {
    isProcessing: boolean;
    progress: number;
  };
}

export const useBackgroundRemoval = () => {
  const [removalState, setRemovalState] = useState<RemovalState>({});
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const removeBackgroundFromFile = useCallback(async (
    fileId: string,
    file: File
  ): Promise<File | null> => {
    // Cancel any existing removal for this file
    const existingController = abortControllers.current.get(fileId);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    abortControllers.current.set(fileId, controller);

    setRemovalState(prev => ({
      ...prev,
      [fileId]: { isProcessing: true, progress: 0 }
    }));

    try {
      const config: Config = {
        progress: (key: string, current: number, total: number) => {
          const progress = Math.round((current / total) * 100);
          setRemovalState(prev => ({
            ...prev,
            [fileId]: { isProcessing: true, progress }
          }));
        },
        output: {
          format: 'image/png',
          quality: 1.0
        }
      };

      const blob = await removeBackground(file, config);
      
      // Convert blob to File with transparent background indicator in name
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const newFile = new File([blob], `${baseName}-nobg.png`, { type: 'image/png' });

      setRemovalState(prev => ({
        ...prev,
        [fileId]: { isProcessing: false, progress: 100 }
      }));

      toast.success('Hintergrund erfolgreich entfernt');
      return newFile;
    } catch (error) {
      console.error('Background removal failed:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled, don't show error
        return null;
      }
      
      toast.error('Hintergrund konnte nicht entfernt werden');
      setRemovalState(prev => ({
        ...prev,
        [fileId]: { isProcessing: false, progress: 0 }
      }));
      return null;
    } finally {
      abortControllers.current.delete(fileId);
    }
  }, []);

  const cancelRemoval = useCallback((fileId: string) => {
    const controller = abortControllers.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(fileId);
    }
    setRemovalState(prev => ({
      ...prev,
      [fileId]: { isProcessing: false, progress: 0 }
    }));
  }, []);

  const isProcessing = useCallback((fileId: string) => {
    return removalState[fileId]?.isProcessing || false;
  }, [removalState]);

  const getProgress = useCallback((fileId: string) => {
    return removalState[fileId]?.progress || 0;
  }, [removalState]);

  return {
    removeBackgroundFromFile,
    cancelRemoval,
    isProcessing,
    getProgress,
    removalState
  };
};
