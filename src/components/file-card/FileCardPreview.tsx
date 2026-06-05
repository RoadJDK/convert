import { cn } from "@/lib/utils";
import type { ConvertibleFile } from "@/types/converter";
import { ConvertPlayIcon, ImageFormatIcon, VideoTimelineIcon } from "@/components/icons/MediaConvertIcons";

type FileCardPreviewProps = {
  file: ConvertibleFile;
  previewUrl?: string | null;
};

export function FileCardPreview({ file, previewUrl }: FileCardPreviewProps) {
  const isImage = file.type === "image";

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-12 sm:w-12",
          isImage ? "bg-primary/15" : "bg-accent/15",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={file.originalName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-accent">
            <ConvertPlayIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        )}
      </div>
      <div
        className={cn(
          "absolute left-1 top-1 rounded-md border border-background/70 p-0.5 shadow-sm",
          isImage ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        {isImage ? <ImageFormatIcon className="h-3 w-3" /> : <VideoTimelineIcon className="h-3 w-3" />}
      </div>
    </div>
  );
}
