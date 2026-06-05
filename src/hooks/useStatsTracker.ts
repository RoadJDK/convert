import { useCallback } from 'react';
import { incrementAIRenameStat, incrementConversionStat } from '@/lib/localStats';

export const useStatsTracker = () => {
  const trackConversion = useCallback(async (type: 'image' | 'video') => {
    incrementConversionStat(type);
  }, []);

  const trackAIRename = useCallback(async () => {
    incrementAIRenameStat();
  }, []);

  return { trackConversion, trackAIRename };
};
