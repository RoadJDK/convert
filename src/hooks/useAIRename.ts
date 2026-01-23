import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAIRename = () => {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const generateName = useCallback(async (fileId: string, fileName: string, fileType: 'image' | 'video'): Promise<string | null> => {
    setIsLoading(prev => ({ ...prev, [fileId]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-rename', {
        body: { fileName, fileType }
      });

      if (error) {
        console.error('AI rename error:', error);
        toast.error('KI-Umbenennung fehlgeschlagen');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data?.suggestedName || null;
    } catch (err) {
      console.error('AI rename error:', err);
      toast.error('KI-Umbenennung fehlgeschlagen');
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [fileId]: false }));
    }
  }, []);

  return { generateName, isLoading };
};