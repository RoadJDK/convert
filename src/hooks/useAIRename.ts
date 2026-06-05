import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useStatsTracker } from './useStatsTracker';
import { useRateLimiter } from './useRateLimiter';
import { generateLocalAIRename } from '@/lib/localAIRename';

let hasShownLocalModelToast = false;

export const useAIRename = () => {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const { trackAIRename } = useStatsTracker();
  const { recordUsage } = useRateLimiter();

  const generateName = useCallback(async (
    fileId: string,
    fileName: string,
    fileType: 'image' | 'video',
    file?: File
  ): Promise<string | null> => {
    if (!recordUsage('renames')) {
      return null;
    }

    setIsLoading(prev => ({ ...prev, [fileId]: true }));

    try {
      if (!hasShownLocalModelToast) {
        toast.info('Lokales KI-Modell wird vorbereitet. Der erste Lauf kann dauern.');
        hasShownLocalModelToast = true;
      }

      const suggestedName = await generateLocalAIRename({
        originalName: file?.name ?? fileName,
        fileType,
        file,
      });

      if (suggestedName) {
        trackAIRename();
      }

      return suggestedName || null;
    } catch (err) {
      console.error('Local AI rename error:', err);
      toast.error('Lokale KI-Umbenennung fehlgeschlagen');
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [fileId]: false }));
    }
  }, [recordUsage, trackAIRename]);

  return { generateName, isLoading };
};
