import { Button } from "@/components/ui/button";
import { FormatSelector } from "@/components/FormatSelector";
import { QualitySettings as QualitySettingsComponent } from "@/components/QualitySettings";
import type { ConvertibleFile, OutputFormat, QualitySettings } from "@/types/converter";
import {
  ConvertPlayIcon,
  CropFrameIcon,
  DownloadTrayIcon,
  LoaderRingIcon,
  RemoveFileIcon,
  RenameSparkIcon,
  ResetFrameIcon,
} from "@/components/icons/MediaConvertIcons";

type Dimensions = { width: number; height: number };

type FileCardActionsProps = {
  file: ConvertibleFile;
  isAIRenaming?: boolean;
  originalDimensions?: Dimensions;
  removeBackgroundEnabled?: boolean;
  removeWatermarkEnabled?: boolean;
  showIndividualActions: boolean;
  onAIRename?: () => void;
  onConvert: () => void;
  onCropClick: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onReset?: () => void;
  onSettingsChange: (settings: QualitySettings) => void;
  onToggleRemoveBackground?: (enabled: boolean) => void;
  onToggleRemoveWatermark?: (enabled: boolean) => void;
};

export function FileCardActions({
  file,
  isAIRenaming,
  originalDimensions,
  removeBackgroundEnabled,
  removeWatermarkEnabled,
  showIndividualActions,
  onAIRename,
  onConvert,
  onCropClick,
  onDownload,
  onRemove,
  onReset,
  onSettingsChange,
  onToggleRemoveBackground,
  onToggleRemoveWatermark,
}: FileCardActionsProps) {
  return (
    <div
      className="flex basis-full shrink-0 flex-wrap items-center justify-between gap-2 pt-1 sm:basis-auto sm:justify-end sm:gap-1 sm:pt-0"
      data-testid="file-card-actions"
    >
      {file.status === "pending" && showIndividualActions && (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-none sm:gap-1">
            <FormatSelector
              fileType={file.type}
              currentFormat={file.qualitySettings.outputFormat}
              onChange={(format: OutputFormat) => onSettingsChange({ ...file.qualitySettings, outputFormat: format })}
            />
            <QualitySettingsComponent
              settings={file.qualitySettings}
              onChange={onSettingsChange}
              originalSize={file.originalSize}
              originalFormat={file.file.type}
              originalDimensions={originalDimensions}
              cropArea={file.cropArea}
              fileType={file.type}
              removeBackground={removeBackgroundEnabled}
              onRemoveBackgroundChange={onToggleRemoveBackground}
              removeWatermark={removeWatermarkEnabled}
              onRemoveWatermarkChange={onToggleRemoveWatermark}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={onCropClick}
              className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
              aria-label="Zuschneiden"
              title="Zuschneiden"
            >
              <CropFrameIcon className="h-4 w-4" />
            </Button>
            {onAIRename && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onAIRename}
                disabled={isAIRenaming}
                className="h-11 w-11 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                aria-label="KI-Umbenennung"
                title="KI-Umbenennung"
              >
                {isAIRenaming ? <LoaderRingIcon className="h-4 w-4 animate-spin" /> : <RenameSparkIcon className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <Button size="sm" onClick={onConvert} aria-label="Start" className="h-11 min-w-11 gap-1 px-3 sm:ml-2 sm:h-9 sm:gap-2">
            <ConvertPlayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Start</span>
          </Button>
        </>
      )}

      {file.status === "pending" && !showIndividualActions && (
        <span className="hidden text-xs italic text-muted-foreground sm:inline">Gruppenauswahl</span>
      )}

      {file.status === "converting" && (
        <Button size="sm" disabled variant="secondary" className="h-11 w-11 p-0 sm:h-8 sm:w-8">
          <LoaderRingIcon className="h-4 w-4 animate-spin" />
        </Button>
      )}

      {file.status === "completed" && (
        <div className="flex items-center gap-1">
          {onReset && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
              aria-label="Zurücksetzen und neu konfigurieren"
              title="Zurücksetzen und neu konfigurieren"
            >
              <ResetFrameIcon className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={onDownload}
            aria-label="Download"
            className="h-11 gap-1 bg-success text-success-foreground hover:bg-success/90 sm:h-9 sm:gap-2"
          >
            <DownloadTrayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      )}

      {file.status === "error" && (
        <Button size="sm" variant="secondary" onClick={onConvert}>
          Erneut
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        aria-label="Datei entfernen"
        className="h-11 w-11 p-0 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
      >
        <RemoveFileIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
