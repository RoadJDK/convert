import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { EMPTY_LOCAL_STATS, readLocalStats, type LocalStats } from '@/lib/localStats';
import { BatchFilesIcon, ImageFormatIcon, RenameSparkIcon, TrendStatsIcon, VideoTimelineIcon } from '@/components/icons/MediaConvertIcons';

interface StatsPopupProps {
  open: boolean;
  onClose: () => void;
}

export const StatsPopup = ({ open, onClose }: StatsPopupProps) => {
  const [stats, setStats] = useState<LocalStats>(EMPTY_LOCAL_STATS);

  useEffect(() => {
    if (open) {
      setStats(readLocalStats());
    }
  }, [open]);

  const totalConversions = stats.imagesConverted + stats.videosConverted + stats.pdfsConverted;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendStatsIcon className="h-5 w-5 text-primary" />
            Deine Statistiken
          </DialogTitle>
          <DialogDescription>
            Lokal in diesem Browser gespeicherte Nutzung.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
            {/* Total conversions */}
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4 text-center">
              <p className="text-4xl font-bold text-foreground">{totalConversions}</p>
              <p className="text-sm text-muted-foreground mt-1">Konvertierungen gesamt</p>
            </div>

            {/* Individual stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <ImageFormatIcon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats.imagesConverted}</p>
                <p className="text-xs text-muted-foreground">Bilder</p>
              </div>

              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-accent/10 p-2">
                    <VideoTimelineIcon className="h-4 w-4 text-accent-foreground" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats.videosConverted}</p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>

              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <BatchFilesIcon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats.pdfsConverted}</p>
                <p className="text-xs text-muted-foreground">PDFs</p>
              </div>

              <div className="rounded-lg bg-card border border-border p-3 text-center">
                <div className="flex justify-center mb-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <RenameSparkIcon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-semibold">{stats.aiRenamesUsed}</p>
                <p className="text-xs text-muted-foreground">KI-Renames</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-2">
              Keine Server-Statistik. Keine Nutzerprofile.
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
