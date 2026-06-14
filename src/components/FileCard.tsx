import { useCallback, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CompressionStats } from "@/components/CompressionStats";
import { FileCardActions } from "@/components/file-card/FileCardActions";
import { FileCardPreview } from "@/components/file-card/FileCardPreview";
import { useFilePreview } from "@/hooks/useFilePreview";
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
      className="glass-panel group rounded-xl p-3 transition-all duration-200 hover:border-primary/30 hover:shadow-lifted sm:p-4"
      data-testid="file-card"
    >
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
        {showCheckbox && (
          <div className="flex items-center pt-2 sm:pt-3">
            <Checkbox checked={selected} onCheckedChange={(checked) => onSelectChange?.(checked === true)} />
          </div>
        )}

        <FileCardPreview file={file} previewUrl={showPreview} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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
                <p className="truncate text-sm font-medium text-foreground sm:text-base" title={getDisplayName()}>
                  {getDisplayName()}
                </p>
                {file.status === "completed" && (
                  <button onClick={handleStartEdit} className="opacity-0 transition-opacity group-hover:opacity-100">
                    <PencilTagIcon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </>
            )}
          </div>

          <p className="mt-1 truncate text-xs text-muted-foreground">
            <span className="hidden sm:inline">{file.originalName} • </span>
            {formatFileSize(file.file.size)}
            {file.cropArea && <span className="ml-2 text-primary">• Zugeschnitten</span>}
            {file.cleanupArea && <span className="ml-2 text-primary">• Bereinigungsbereich</span>}
            {file.cleanupMask && <span className="ml-2 text-primary">• Freihandmaske</span>}
            {file.trimRange && <span className="ml-2 text-accent">• Geschnitten</span>}
            {file.videoRotation && <span className="ml-2 text-accent">• Gedreht</span>}
          </p>

          {file.status === "pending" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {file.type === "pdf"
                ? "PDF: lokal neu schreiben und Metadaten entfernen"
                : `Qualität: ${file.qualitySettings.mode === "percentage" ? `${file.qualitySettings.percentage}%` : `max ${file.qualitySettings.maxSizeKB} KB`}`}
            </p>
          )}

          {file.status === "converting" && (
            <div className="mt-2 sm:mt-3">
              <Progress value={file.progress} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">Konvertiere... {Math.round(file.progress)}%</p>
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

          {file.suggestedName && file.status === "completed" && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1">
              <span className="text-xs text-primary">KI-Vorschlag angewendet</span>
            </div>
          )}
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
