import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image, Video, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StatsPopupProps {
  open: boolean;
  onClose: () => void;
}

interface UserStats {
  images_converted: number;
  videos_converted: number;
  ai_renames_used: number;
}

export const StatsPopup = ({ open, onClose }: StatsPopupProps) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open]);

  const loadStats = async () => {
    setLoading(true);
    
    try {
      // Get current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id) {
        setStats({ images_converted: 0, videos_converted: 0, ai_renames_used: 0 });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('images_converted, videos_converted, ai_renames_used')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading stats:', error);
        setStats({ images_converted: 0, videos_converted: 0, ai_renames_used: 0 });
      } else {
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setStats({ images_converted: 0, videos_converted: 0, ai_renames_used: 0 });
    } finally {
      setLoading(false);
    }
  };

  const totalConversions = (stats?.images_converted || 0) + (stats?.videos_converted || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Deine Statistiken
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Total conversions */}
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">{totalConversions}</p>
              <p className="text-sm text-muted-foreground mt-1">Konvertierungen gesamt</p>
            </div>

            {/* Individual stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Image className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats?.images_converted || 0}</p>
                <p className="text-xs text-muted-foreground">Bilder</p>
              </div>

              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-accent/10 p-2">
                    <Video className="h-4 w-4 text-accent-foreground" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats?.videos_converted || 0}</p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>

              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats?.ai_renames_used || 0}</p>
                <p className="text-xs text-muted-foreground">KI-Renames</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-2">
              Alle Konvertierungen erfolgen lokal in deinem Browser
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};