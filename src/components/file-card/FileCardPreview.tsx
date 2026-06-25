import { cn } from "@/lib/utils";
import type { ConvertibleFile } from "@/types/converter";
import { BatchFilesIcon, ImageFormatIcon, VideoTimelineIcon } from "@/components/icons/MediaConvertIcons";

type FileCardPreviewProps = {
  file: ConvertibleFile;
  previewUrl?: string | null;
};

export function FileCardPreview({ file, previewUrl }: FileCardPreviewProps) {
  const typeClass = file.type === "image"
    ? "bg-[var(--ms-accent-tint)]"
    : file.type === "video"
      ? "bg-[var(--ms-accent-tint)]"
      : "bg-[var(--ms-cream)]";
  const iconClass = file.type === "image"
    ? "bg-primary text-primary-foreground"
    : file.type === "video"
      ? "bg-accent text-accent-foreground"
      : "bg-primary text-primary-foreground";
  const TypeIcon = file.type === "image" ? ImageFormatIcon : file.type === "video" ? VideoTimelineIcon : BatchFilesIcon;

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--ms-radius-card-small)] border border-border sm:h-16 sm:w-16",
          typeClass,
        )}
        data-testid="file-card-preview"
      >
        {previewUrl && <img src={previewUrl} alt={file.originalName} className="h-full w-full object-cover" />}
        <div
          className={cn(
            "absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-background/70 shadow-sm",
            iconClass,
          )}
          data-testid="file-card-preview-type-icon"
        >
          <TypeIcon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
