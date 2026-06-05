import { cn } from "@/lib/utils";
import type { ConvertibleFile } from "@/types/converter";
import { ImageFormatIcon, VideoTimelineIcon } from "@/components/icons/MediaConvertIcons";

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
          "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-12 sm:w-12",
          isImage ? "bg-primary/15" : "bg-accent/15",
        )}
        data-testid="file-card-preview"
      >
        {previewUrl && <img src={previewUrl} alt={file.originalName} className="h-full w-full object-cover" />}
        <div
          className={cn(
            "absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-background/70 shadow-sm sm:h-7 sm:w-7",
            isImage ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
          )}
          data-testid="file-card-preview-type-icon"
        >
          {isImage ? <ImageFormatIcon className="h-3.5 w-3.5" /> : <VideoTimelineIcon className="h-3.5 w-3.5" />}
        </div>
      </div>
    </div>
  );
}
