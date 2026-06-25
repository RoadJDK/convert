import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CompressionStats } from "@/components/CompressionStats";
import { FileCardActions } from "@/components/file-card/FileCardActions";
import { FileCardPreview } from "@/components/file-card/FileCardPreview";
import { useFilePreview } from "@/hooks/useFilePreview";
import { cn } from "@/lib/utils";
import {
  type ConvertibleFile,
  formatFileSize,
  getOutputExtension,
  type QualitySettings,
} from "@/types/converter";
import { AlertMarkIcon, PencilTagIcon } from "@/components/icons/MediaConvertIcons";

interface FileCardProps {
  file: ConvertibleFile;
  onConvert: () => void;
  onRemove: () => void;
  onDownload: (customName?: string) => void;
  onRename: (newName: string) => void;
  onSettingsChange: (settings: QualitySettings) => void;
  onCropClick: () => void;
  onAIRename?: () => void;
  isAIRenaming?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  showCheckbox?: boolean;
  videoPreviewUrl?: string;
  onReset?: () => void;
  removeBackgroundEnabled?: boolean;
  onToggleRemoveBackground?: (enabled: boolean) => void;
  removeWatermarkEnabled?: boolean;
  onToggleRemoveWatermark?: (enabled: boolean) => void;
  onCleanupAreaClick?: () => void;
}

export const FileCard = ({
  file,
  onConvert,
  onRemove,
  onDownload,
  onRename,
  onSettingsChange,
  onCropClick,
  onAIRename,
  isAIRenaming,
  selected = false,
  onSelectChange,
  showCheckbox = false,
  videoPreviewUrl,
  onReset,
  removeBackgroundEnabled,
  onToggleRemoveBackground,
  removeWatermarkEnabled,
  onToggleRemoveWatermark,
  onCleanupAreaClick,
}: FileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const { originalDimensions, showPreview } = useFilePreview(file, videoPreviewUrl);
  const extension = getOutputExtension(file.type, file.qualitySettings.outputFormat);
  const showIndividualActions = !selected;
  const statusLabel = file.status === "pending"
    ? "bereit"
    : file.status === "converting"
      ? "läuft"
      : file.status === "completed"
        ? "fertig"
        : "fehler";
  const qualityLabel = file.type === "pdf"
    ? "PDF"
    : file.qualitySettings.mode === "percentage"
      ? `${file.qualitySettings.percentage}%`
      : `max ${file.qualitySettings.maxSizeKB} KB`;
  const overrideLabels = [
    file.cropArea ? "Ausschnitt" : null,
    file.cleanupArea ? "Bereich" : null,
    file.cleanupMask ? "Freihand" : null,
    file.trimRange ? "Schnitt" : null,
    file.videoRotation ? "Rotation" : null,
    file.removeBackground ? "Hintergrund" : null,
    file.removeWatermark ? "Bereinigen" : null,
  ].filter(Boolean);

  const getDisplayName = () => {
    const baseName = file.suggestedName || file.originalName.replace(/\.[^/.]+$/, "");
    return `${baseName}.${extension}`;
  };

  const handleStartEdit = useCallback(() => {
    const baseName = file.suggestedName || file.originalName.replace(/\.[^/.]+$/, "");
    setEditName(baseName);
    setIsEditing(true);
  }, [file.suggestedName, file.originalName]);

  const handleSaveEdit = useCallback(() => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  }, [editName, onRename]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        handleSaveEdit();
      } else if (event.key === "Escape") {
        setIsEditing(false);
      }
    },
    [handleSaveEdit],
  );

  return (
    <div
      className={cn(
        "ms-file-card group rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3 transition-colors duration-200 hover:border-[var(--ms-ink)]",
        selected && "border-ring bg-[var(--ms-accent-tint)]",
      )}
      data-testid="file-card"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          {showCheckbox && (
            <div className="flex items-center pt-3">
              <Checkbox
                aria-label={`${getDisplayName()} auswählen`}
                checked={selected}
                onCheckedChange={(checked) => onSelectChange?.(checked === true)}
              />
            </div>
          )}

          <FileCardPreview file={file} previewUrl={showPreview} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              {isEditing ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground">.{extension}</span>
                </div>
              ) : (
                <>
                  <p className="truncate text-base font-semibold text-foreground" title={getDisplayName()}>
                    {getDisplayName()}
                  </p>
                  <span className="ms-chip hidden shrink-0 sm:inline">{statusLabel}</span>
                  {file.status === "completed" && (
                    <button
                      onClick={handleStartEdit}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ms-radius-pill)] text-muted-foreground transition-colors hover:bg-[var(--ms-accent-tint)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      aria-label="Exportname ändern"
                      title="Exportname ändern"
                    >
                      <PencilTagIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate" title={file.originalName}>{file.originalName}</span>
              <span>{formatFileSize(file.file.size)}</span>
              {file.status === "pending" && <span>{qualityLabel}</span>}
            </div>

            {(overrideLabels.length > 0 || file.suggestedName) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {file.suggestedName && <span className="ms-chip ms-chip-accent">KI-Name</span>}
                {overrideLabels.map((label) => (
                  <span key={label} className="ms-chip">
                    {label}
                  </span>
                ))}
              </div>
            )}

            {file.status === "converting" && (
              <div className="mt-2 sm:mt-3">
                <Progress value={file.progress} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">{Math.round(file.progress)}%</p>
              </div>
            )}

            {file.status === "completed" && file.convertedSize && (
              <div className="mt-2">
                <CompressionStats originalSize={file.originalSize} convertedSize={file.convertedSize} />
              </div>
            )}

            {file.status === "error" && (
              <div className="mt-2 flex items-center gap-2 text-destructive">
                <AlertMarkIcon className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs">{file.error}</span>
              </div>
            )}
          </div>
        </div>

        <FileCardActions
          file={file}
          isAIRenaming={isAIRenaming}
          originalDimensions={originalDimensions}
          removeBackgroundEnabled={removeBackgroundEnabled}
          removeWatermarkEnabled={removeWatermarkEnabled}
          cleanupArea={file.cleanupArea}
          cleanupMask={file.cleanupMask}
          showIndividualActions={showIndividualActions}
          onAIRename={onAIRename}
          onConvert={onConvert}
          onCropClick={onCropClick}
          downloadHref={file.status === "completed" ? file.convertedUrl : undefined}
          downloadName={file.status === "completed" ? getDisplayName() : undefined}
          onDownload={() => onDownload()}
          onRemove={onRemove}
          onReset={onReset}
          onSettingsChange={onSettingsChange}
          onToggleRemoveBackground={onToggleRemoveBackground}
          onToggleRemoveWatermark={onToggleRemoveWatermark}
          onCleanupAreaClick={onCleanupAreaClick}
        />
      </div>
    </div>
  );
};
