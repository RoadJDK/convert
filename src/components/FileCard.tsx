import { useCallback, useState, useEffect } from 'react';
import { Download, Trash2, Play, AlertCircle, Loader2, Pencil, Crop, Sparkles, Image, Film, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ConvertibleFile, getOutputExtension, formatFileSize, QualitySettings, FileType, DEFAULT_QUALITY_SETTINGS, OutputFormat } from '@/types/converter';
import { QualitySettings as QualitySettingsComponent } from './QualitySettings';
import { CompressionStats } from './CompressionStats';
import { FormatSelector } from './FormatSelector';

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
}: FileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const extension = getOutputExtension(file.type, file.qualitySettings.outputFormat);

  // Generate preview URL for images
  useEffect(() => {
    if (file.type === 'image') {
      const url = URL.createObjectURL(file.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file.file, file.type]);

  const getDisplayName = () => {
    const baseName = file.suggestedName || file.originalName.replace(/\.[^/.]+$/, '');
    return `${baseName}.${extension}`;
  };

  const handleStartEdit = useCallback(() => {
    const baseName = file.suggestedName || file.originalName.replace(/\.[^/.]+$/, '');
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
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleSaveEdit]
  );

  // Hide individual action buttons when file is selected (in group)
  const showIndividualActions = !selected;

  // Determine preview to show
  const showPreview = file.type === 'image' ? previewUrl : videoPreviewUrl;

  return (
    <div className="group rounded-xl bg-card p-3 sm:p-4 shadow-soft transition-all duration-200 hover:shadow-lifted">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Checkbox for selection */}
        {showCheckbox && (
          <div className="flex items-center pt-2 sm:pt-3">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectChange?.(checked === true)}
            />
          </div>
        )}

        {/* Preview/Icon with File Type Badge */}
        <div className="relative">
          <div
            className={cn(
              'flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg overflow-hidden',
              file.type === 'image' ? 'bg-primary/20' : 'bg-accent/20'
            )}
          >
            {showPreview ? (
              <img
                src={showPreview}
                alt={file.originalName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-accent">
                <Play className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            )}
          </div>
          {/* File Type Icon Badge */}
          <div className={cn(
            'absolute -top-1 -left-1 rounded-full p-0.5',
            file.type === 'image' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
          )}>
            {file.type === 'image' ? (
              <Image className="h-3 w-3" />
            ) : (
              <Film className="h-3 w-3" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">.{extension}</span>
              </div>
            ) : (
              <>
                <p className="truncate text-sm sm:text-base font-medium text-foreground" title={getDisplayName()}>
                  {getDisplayName()}
                </p>
                {file.status === 'completed' && (
                  <button
                    onClick={handleStartEdit}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground truncate">
            <span className="hidden sm:inline">{file.originalName} • </span>
            {formatFileSize(file.file.size)}
            {file.cropArea && (
              <span className="ml-2 text-primary">• Zugeschnitten</span>
            )}
            {file.trimRange && (
              <span className="ml-2 text-accent">• Geschnitten</span>
            )}
          </p>

          {/* Quality indicator for pending files */}
          {file.status === 'pending' && (
            <p className="mt-1 text-xs text-muted-foreground">
              Qualität: {file.qualitySettings.mode === 'percentage' 
                ? `${file.qualitySettings.percentage}%` 
                : `max ${file.qualitySettings.maxSizeKB} KB`}
            </p>
          )}

          {/* Progress Bar during conversion */}
          {file.status === 'converting' && (
            <div className="mt-2 sm:mt-3">
              <Progress value={file.progress} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                Konvertiere... {Math.round(file.progress)}%
              </p>
            </div>
          )}

          {/* Compression Stats */}
          {file.status === 'completed' && file.convertedSize && (
            <div className="mt-2">
              <CompressionStats 
                originalSize={file.originalSize} 
                convertedSize={file.convertedSize} 
              />
            </div>
          )}

          {/* Error */}
          {file.status === 'error' && (
            <div className="mt-2 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs truncate">{file.error}</span>
            </div>
          )}

          {/* Rename hint */}
          {file.suggestedName && file.status === 'completed' && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1">
              <span className="text-xs text-primary">
                ✨ KI-Vorschlag angewendet
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 flex-wrap justify-end">
          {file.status === 'pending' && showIndividualActions && (
            <>
              <div className="hidden sm:flex items-center gap-1">
                <FormatSelector
                  fileType={file.type}
                  currentFormat={file.qualitySettings.outputFormat}
                  onChange={(format: OutputFormat) => onSettingsChange({ ...file.qualitySettings, outputFormat: format })}
                />
                <QualitySettingsComponent
                  settings={file.qualitySettings}
                  onChange={onSettingsChange}
                  originalSize={file.originalSize}
                  fileType={file.type}
                  removeBackground={removeBackgroundEnabled}
                  onRemoveBackgroundChange={onToggleRemoveBackground}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCropClick}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Zuschneiden"
                >
                  <Crop className="h-4 w-4" />
                </Button>
                {onAIRename && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onAIRename}
                    disabled={isAIRenaming}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="KI-Umbenennung"
                  >
                    {isAIRenaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                onClick={onConvert}
                className="gap-1 sm:gap-2 ml-1 sm:ml-2"
              >
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Start</span>
              </Button>
            </>
          )}

          {file.status === 'pending' && !showIndividualActions && (
            <span className="text-xs text-muted-foreground italic hidden sm:inline">
              Gruppenauswahl
            </span>
          )}

          {file.status === 'converting' && (
            <Button size="sm" disabled variant="secondary" className="h-8 w-8 p-0">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}

          {file.status === 'completed' && (
            <div className="flex items-center gap-1">
              {onReset && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onReset}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Zurücksetzen und neu konfigurieren"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => onDownload()}
                className="gap-1 sm:gap-2 bg-success text-success-foreground hover:bg-success/90"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          )}

          {file.status === 'error' && (
            <Button size="sm" variant="secondary" onClick={onConvert}>
              Erneut
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
