import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserData } from '@/components/UserRegistration';

export const useStatsTracker = () => {
  const trackConversion = useCallback(async (type: 'image' | 'video') => {
    const userData = getUserData();
    if (!userData?.email) return;

    try {
      const column = type === 'image' ? 'images_converted' : 'videos_converted';
      
      // Get current value and increment
      const { data: profile } = await supabase
        .from('profiles')
        .select(column)
        .eq('email', userData.email)
        .single();

      if (profile) {
        const currentValue = (profile as any)[column] || 0;
        await supabase
          .from('profiles')
          .update({ [column]: currentValue + 1 })
          .eq('email', userData.email);
      }
    } catch (err) {
      console.error('Error tracking conversion:', err);
    }
  }, []);

  const trackAIRename = useCallback(async () => {
    const userData = getUserData();
    if (!userData?.email) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_renames_used')
        .eq('email', userData.email)
        .single();

      if (profile) {
        const currentValue = profile.ai_renames_used || 0;
        await supabase
          .from('profiles')
          .update({ ai_renames_used: currentValue + 1 })
          .eq('email', userData.email);
      }
    } catch (err) {
      console.error('Error tracking AI rename:', err);
    }
  }, []);

  return { trackConversion, trackAIRename };
};