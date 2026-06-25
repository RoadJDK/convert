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
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <DialogHeader>
          <div className="border-b border-[var(--ms-hairline)] px-5 py-4 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2">
            <TrendStatsIcon className="h-5 w-5 text-accent" />
            Lokale Nutzung
          </DialogTitle>
          <DialogDescription className="mt-1">
            Nur in diesem Browser gespeichert.
          </DialogDescription>
          </div>
        </DialogHeader>

        <div className="bg-[var(--ms-cream)] px-5 py-5">
          <div className="mb-4">
            <p className="ms-h2 text-foreground">{totalConversions}</p>
            <p className="ms-note">Konvertierungen gesamt</p>
          </div>

          <div className="divide-y divide-[var(--ms-hairline)] border-y border-[var(--ms-hairline)]">
            {[
              { icon: ImageFormatIcon, label: "Bilder", value: stats.imagesConverted },
              { icon: VideoTimelineIcon, label: "Videos", value: stats.videosConverted },
              { icon: BatchFilesIcon, label: "PDFs", value: stats.pdfsConverted },
              { icon: RenameSparkIcon, label: "KI-Namen", value: stats.aiRenamesUsed },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Icon className="h-4 w-4 text-accent" />
                  {label}
                </span>
                <span className="text-lg font-semibold">{value}</span>
              </div>
            ))}
          </div>

          <p className="ms-note mt-4">
            Keine Server-Statistik. Keine Nutzerprofile.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
