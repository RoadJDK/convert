import { Button } from "@/components/ui/button";
import { FormatSelector } from "@/components/FormatSelector";
import { QualitySettings as QualitySettingsComponent } from "@/components/QualitySettings";
import { cn } from "@/lib/utils";
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
  cleanupArea?: ConvertibleFile["cleanupArea"];
  cleanupMask?: ConvertibleFile["cleanupMask"];
  showIndividualActions: boolean;
  onAIRename?: () => void;
  onConvert: () => void;
  onCropClick: () => void;
  onDownload: () => void;
  downloadHref?: string;
  downloadName?: string;
  onRemove: () => void;
  onReset?: () => void;
  onSettingsChange: (settings: QualitySettings) => void;
  onToggleRemoveBackground?: (enabled: boolean) => void;
  onToggleRemoveWatermark?: (enabled: boolean) => void;
  onCleanupAreaClick?: () => void;
};

export function FileCardActions({
  file,
  isAIRenaming,
  originalDimensions,
  removeBackgroundEnabled,
  removeWatermarkEnabled,
  cleanupArea,
  cleanupMask,
  showIndividualActions,
  onAIRename,
  onConvert,
  onCropClick,
  onDownload,
  downloadHref,
  downloadName,
  onRemove,
  onReset,
  onSettingsChange,
  onToggleRemoveBackground,
  onToggleRemoveWatermark,
  onCleanupAreaClick,
}: FileCardActionsProps) {
  const toolButtonClass = "h-11 w-11 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8";
  const supportsMediaTools = file.type !== "pdf";
  const showsAIRename = Boolean(onAIRename) && supportsMediaTools;
  const pendingActionGridClass = cn(
    "grid w-full justify-between gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end sm:gap-1",
    supportsMediaTools
      ? showsAIRename
        ? "grid-cols-[74px_repeat(4,44px)]"
        : "grid-cols-[74px_repeat(3,44px)]"
      : "grid-cols-[74px_44px]",
  );

  const renderRemoveButton = (className?: string) => (
    <Button
      size="sm"
      variant="ghost"
      onClick={onRemove}
      aria-label="Datei entfernen"
      className={cn(toolButtonClass, "hover:text-destructive", className)}
    >
      <RemoveFileIcon className="h-4 w-4" />
    </Button>
  );

  return (
    <div
      className="basis-full shrink-0 pt-1 sm:basis-auto sm:pt-0"
      data-testid="file-card-actions"
    >
      {file.status === "pending" && showIndividualActions && (
        <div className={pendingActionGridClass}>
          <div className="min-w-0">
            <FormatSelector
              fileType={file.type}
              currentFormat={file.qualitySettings.outputFormat}
              onChange={(format: OutputFormat) => onSettingsChange({ ...file.qualitySettings, outputFormat: format })}
            />
          </div>
          {supportsMediaTools && (
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
              cleanupArea={cleanupArea}
              cleanupMask={cleanupMask}
              onCleanupAreaClick={onCleanupAreaClick}
            />
          )}
          {supportsMediaTools && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCropClick}
              className={toolButtonClass}
              aria-label="Zuschneiden"
              title="Zuschneiden"
            >
              <CropFrameIcon className="h-4 w-4" />
            </Button>
          )}
          {showsAIRename && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onAIRename}
              disabled={isAIRenaming}
              className={toolButtonClass}
              aria-label="KI-Umbenennung"
              title="KI-Umbenennung"
            >
              {isAIRenaming ? <LoaderRingIcon className="h-4 w-4 animate-spin" /> : <RenameSparkIcon className="h-4 w-4" />}
            </Button>
          )}
          {renderRemoveButton("sm:order-6")}
          <Button
            size="sm"
            onClick={onConvert}
            aria-label="Start"
            className="col-span-full h-11 w-full gap-2 px-3 sm:order-5 sm:col-span-1 sm:ml-2 sm:h-9 sm:w-auto"
            data-testid="file-card-start-action"
          >
            <ConvertPlayIcon className="h-4 w-4" />
            <span>Start</span>
          </Button>
        </div>
      )}

      {file.status === "pending" && !showIndividualActions && (
        <div className="flex items-center justify-end gap-2">
          <span className="hidden text-xs italic text-muted-foreground sm:inline">Gruppenauswahl</span>
          {renderRemoveButton()}
        </div>
      )}

      {file.status === "converting" && (
        <div className="flex items-center justify-end gap-2 sm:gap-1">
          <Button size="sm" disabled variant="secondary" className="h-11 w-11 p-0 sm:h-8 sm:w-8">
            <LoaderRingIcon className="h-4 w-4 animate-spin" />
          </Button>
          {renderRemoveButton()}
        </div>
      )}

      {file.status === "completed" && (
        <div className="flex items-center justify-end gap-1">
          {onReset && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              className={toolButtonClass}
              aria-label="Zurücksetzen und neu konfigurieren"
              title="Zurücksetzen und neu konfigurieren"
            >
              <ResetFrameIcon className="h-4 w-4" />
            </Button>
          )}
          {downloadHref ? (
            <Button
              asChild
              size="sm"
              aria-label="Download"
              className="h-11 min-w-11 gap-1 bg-success text-success-foreground hover:bg-success/90 sm:h-9 sm:gap-2"
            >
              <a href={downloadHref} download={downloadName}>
                <DownloadTrayIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onDownload}
              aria-label="Download"
              className="h-11 min-w-11 gap-1 bg-success text-success-foreground hover:bg-success/90 sm:h-9 sm:gap-2"
            >
              <DownloadTrayIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}
          {renderRemoveButton()}
        </div>
      )}

      {file.status === "error" && (
        <div className="flex items-center justify-end gap-2 sm:gap-1">
          <Button size="sm" variant="secondary" onClick={onConvert}>
            Erneut
          </Button>
          {renderRemoveButton()}
        </div>
      )}
    </div>
  );
}
