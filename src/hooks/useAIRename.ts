import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStatsTracker } from './useStatsTracker';
import { useRateLimiter } from './useRateLimiter';

export const useAIRename = () => {
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const { trackAIRename } = useStatsTracker();
  const { recordUsage } = useRateLimiter();

  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateName = useCallback(async (
    fileId: string,
    fileName: string,
    fileType: 'image' | 'video',
    file?: File
  ): Promise<string | null> => {
    // Check rate limit before making API call (150 renames per hour)
    if (!recordUsage('renames')) {
      return null;
    }

    setIsLoading(prev => ({ ...prev, [fileId]: true }));

    try {
      let imageData: string | undefined;
      
      // For images, convert to base64 for vision analysis
      if (fileType === 'image' && file) {
        // Resize image to reduce payload size (max 512px)
        const resizedData = await resizeImageForAnalysis(file);
        imageData = resizedData;
      }

      const { data, error } = await supabase.functions.invoke('ai-rename', {
        body: { fileName, fileType, imageData }
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

      // Track AI rename usage
      if (data?.suggestedName) {
        trackAIRename();
      }

      return data?.suggestedName || null;
    } catch (err) {
      console.error('AI rename error:', err);
      toast.error('KI-Umbenennung fehlgeschlagen');
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [fileId]: false }));
    }
  }, [recordUsage, trackAIRename]);

  return { generateName, isLoading };
};

// Helper function to resize image for analysis
async function resizeImageForAnalysis(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    
    img.onload = () => {
      const maxSize = 512;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG for smaller size
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
