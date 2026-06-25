import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormatSelector } from "@/components/FormatSelector";
import { QualitySettings as QualitySettingsComponent } from "@/components/QualitySettings";
import { cn } from "@/lib/utils";
import type { ConvertibleFile, OutputFormat, QualitySettings } from "@/types/converter";
import {
  ConvertPlayIcon,
  CropFrameIcon,
  DownloadTrayIcon,
  LoaderRingIcon,
  MoreDotsIcon,
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
  const toolButtonClass = "ms-icon-button h-11 w-11 p-0 hover:bg-[var(--ms-accent-tint)] sm:h-[39px] sm:w-[39px]";
  const supportsMediaTools = file.type !== "pdf";
  const showsAIRename = Boolean(onAIRename) && supportsMediaTools;
  const primaryActionLabel = file.type === "image" ? "Kleiner machen" : "Exportieren";

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
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 sm:flex sm:items-center sm:justify-between">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                aria-label="Bearbeiten"
                className="h-11 w-full gap-2 px-3 sm:h-[39px] sm:w-auto sm:px-4"
              >
                <MoreDotsIcon className="h-4 w-4" />
                <span>Bearbeiten</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              data-file-tools
              align="start"
              side="bottom"
              sideOffset={8}
              collisionPadding={16}
              className="z-50 w-[min(22rem,calc(100vw_-_32px))] space-y-4 border border-border bg-popover shadow-[var(--ms-shadow-panel)]"
            >
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Ausgabe</p>
                <FormatSelector
                  fileType={file.type}
                  currentFormat={file.qualitySettings.outputFormat}
                  onChange={(format: OutputFormat) => onSettingsChange({ ...file.qualitySettings, outputFormat: format })}
                />
              </div>

              {supportsMediaTools && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Werkzeuge</p>
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            onClick={onConvert}
            aria-label={primaryActionLabel}
            className="ms-button-swap h-11 w-full gap-2 px-3 sm:h-[50px] sm:w-auto sm:px-5"
            data-testid="file-card-start-action"
          >
            <ConvertPlayIcon className="h-4 w-4" />
            <span data-label-stack>
              <span data-default-label>{primaryActionLabel}</span>
              <span data-hover-label aria-hidden="true">Lokal starten</span>
            </span>
          </Button>
          {renderRemoveButton("w-11")}
        </div>
      )}

      {file.status === "pending" && !showIndividualActions && (
        <div className="flex items-center justify-end gap-2">
          <span className="ms-chip hidden sm:inline">Auswahl</span>
          {renderRemoveButton()}
        </div>
      )}

      {file.status === "converting" && (
        <div className="flex items-center justify-end gap-2 sm:gap-1">
          <Button size="sm" disabled variant="secondary" className="h-11 w-11 p-0 sm:h-[39px] sm:w-[39px]">
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
              className="h-11 min-w-11 gap-1 sm:h-[39px] sm:gap-2"
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
              className="h-11 min-w-11 gap-1 sm:h-[39px] sm:gap-2"
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
