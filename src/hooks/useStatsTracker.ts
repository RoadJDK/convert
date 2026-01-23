import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useStatsTracker = () => {
  const trackConversion = useCallback(async (type: 'image' | 'video') => {
    try {
      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const column = type === 'image' ? 'images_converted' : 'videos_converted';
      
      // Get current value and increment using user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select(column)
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const currentValue = (profile as any)[column] || 0;
        await supabase
          .from('profiles')
          .update({ [column]: currentValue + 1 })
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error tracking conversion:', err);
    }
  }, []);

  const trackAIRename = useCallback(async () => {
    try {
      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('ai_renames_used')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const currentValue = profile.ai_renames_used || 0;
        await supabase
          .from('profiles')
          .update({ ai_renames_used: currentValue + 1 })
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error tracking AI rename:', err);
    }
  }, []);

  return { trackConversion, trackAIRename };
};
