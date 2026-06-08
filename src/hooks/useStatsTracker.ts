import { useCallback } from 'react';
import { incrementAIRenameStat, incrementConversionStat } from '@/lib/localStats';
import type { FileType } from '@/types/converter';

export const useStatsTracker = () => {
  const trackConversion = useCallback(async (type: FileType) => {
    incrementConversionStat(type);
  }, []);

  const trackAIRename = useCallback(async () => {
    incrementAIRenameStat();
  }, []);

  return { trackConversion, trackAIRename };
};
