import { Image, Video, CheckCircle, Clock } from 'lucide-react';
import { ConvertibleFile } from '@/types/converter';

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="flex items-center gap-3 rounded-xl bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
          <Image className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{images.length}</p>
          <p className="text-xs text-muted-foreground">Bilder</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20">
          <Video className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{videos.length}</p>
          <p className="text-xs text-muted-foreground">Videos</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/20">
          <CheckCircle className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Fertig</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/20">
          <Clock className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{pending.length}</p>
          <p className="text-xs text-muted-foreground">Ausstehend</p>
        </div>
      </div>
    </div>
  );
};
