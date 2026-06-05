import { ConvertibleFile } from '@/types/converter';
import { ConversionDoneIcon, ImageFormatIcon, VideoTimelineIcon, WaitingQueueIcon } from '@/components/icons/MediaConvertIcons';

interface StatsProps {
  files: ConvertibleFile[];
}

export const Stats = ({ files }: StatsProps) => {
  const images = files.filter((f) => f.type === 'image');
  const videos = files.filter((f) => f.type === 'video');
  const completed = files.filter((f) => f.status === 'completed');
  const pending = files.filter((f) => f.status === 'pending' || f.status === 'converting');

  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass-panel flex items-center gap-3 rounded-xl p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <ImageFormatIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{images.length}</p>
          <p className="text-xs text-muted-foreground">Bilder</p>
        </div>
      </div>

      <div className="glass-panel flex items-center gap-3 rounded-xl p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
          <VideoTimelineIcon className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{videos.length}</p>
          <p className="text-xs text-muted-foreground">Videos</p>
        </div>
      </div>

      <div className="glass-panel flex items-center gap-3 rounded-xl p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15">
          <ConversionDoneIcon className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Fertig</p>
        </div>
      </div>

      <div className="glass-panel flex items-center gap-3 rounded-xl p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15">
          <WaitingQueueIcon className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{pending.length}</p>
          <p className="text-xs text-muted-foreground">Ausstehend</p>
        </div>
      </div>
    </div>
  );
};
