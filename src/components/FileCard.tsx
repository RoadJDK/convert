import { useCallback, useState, useMemo, useEffect } from 'react';
import { Download, Trash2, Play, AlertCircle, Loader2, Pencil, Crop, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ConvertibleFile, getOutputExtension, formatFileSize, QualitySettings } from '@/types/converter';
import { QualitySettings as QualitySettingsComponent } from './QualitySettings';
import { CompressionStats } from './CompressionStats';

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
  renameHelperEnabled: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  showCheckbox?: boolean;
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
  renameHelperEnabled,
  selected = false,
  onSelectChange,
  showCheckbox = false,
}: FileCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const extension = getOutputExtension(file.type);

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

  return (
    <div className="group rounded-xl bg-card p-4 shadow-soft transition-all duration-200 hover:shadow-lifted">
      <div className="flex items-start gap-4">
        {/* Checkbox for selection */}
        {showCheckbox && (
          <div className="flex items-center pt-3">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectChange?.(checked === true)}
            />
          </div>
        )}

        {/* Preview/Icon */}
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg overflow-hidden',
            file.type === 'image' ? 'bg-primary/20' : 'bg-accent/20'
          )}
        >
          {previewUrl && file.type === 'image' ? (
            <img
              src={previewUrl}
              alt={file.originalName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-accent">
              <Play className="h-6 w-6" />
            </div>
          )}
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
                <p className="truncate font-medium text-foreground" title={getDisplayName()}>
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

          <p className="mt-1 text-xs text-muted-foreground">
            {file.originalName} • {formatFileSize(file.file.size)}
            {file.cropArea && (
              <span className="ml-2 text-primary">• Zugeschnitten</span>
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

          {/* Progress */}
          {file.status === 'converting' && (
            <div className="mt-3">
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
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">{file.error}</span>
            </div>
          )}

          {/* Rename hint */}
          {renameHelperEnabled && file.suggestedName && file.status === 'completed' && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1">
              <span className="text-xs text-primary">
                ✨ KI-Vorschlag angewendet
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {file.status === 'pending' && (
            <>
              <QualitySettingsComponent
                settings={file.qualitySettings}
                onChange={onSettingsChange}
              />
              {file.type === 'image' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCropClick}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Zuschneiden"
                >
                  <Crop className="h-4 w-4" />
                </Button>
              )}
              {renameHelperEnabled && onAIRename && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onAIRename}
                  disabled={isAIRenaming}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                  title="KI-Umbenennung"
                >
                  {isAIRenaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                size="sm"
                onClick={onConvert}
                className="gap-2 ml-2"
              >
                <Play className="h-4 w-4" />
                Start
              </Button>
            </>
          )}

          {file.status === 'converting' && (
            <Button size="sm" disabled variant="secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}

          {file.status === 'completed' && (
            <Button
              size="sm"
              onClick={() => onDownload()}
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
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
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};