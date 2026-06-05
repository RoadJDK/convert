import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ConvertibleFile, FileType } from '@/types/converter';
import { CloseSelectionIcon, ImageFormatIcon, VideoTimelineIcon } from '@/components/icons/MediaConvertIcons';

interface SelectAllControlsProps {
  pendingFiles: ConvertibleFile[];
  selectedPendingIds: string[];
  onSelectType: (type: FileType) => void;
  onClearSelection: () => void;
}

export const SelectAllControls = ({
  pendingFiles,
  selectedPendingIds,
  onSelectType,
  onClearSelection,
}: SelectAllControlsProps) => {
  const imageCount = useMemo(() => 
    pendingFiles.filter(f => f.type === 'image').length, 
    [pendingFiles]
  );
  
  const videoCount = useMemo(() => 
    pendingFiles.filter(f => f.type === 'video').length, 
    [pendingFiles]
  );

  const selectedType = useMemo((): FileType | null => {
    if (selectedPendingIds.length === 0) return null;
    const firstSelected = pendingFiles.find(f => selectedPendingIds.includes(f.id));
    return firstSelected?.type || null;
  }, [selectedPendingIds, pendingFiles]);

  const allImagesSelected = useMemo(() => {
    const imageFiles = pendingFiles.filter(f => f.type === 'image');
    return imageFiles.length > 0 && imageFiles.every(f => selectedPendingIds.includes(f.id));
  }, [pendingFiles, selectedPendingIds]);

  const allVideosSelected = useMemo(() => {
    const videoFiles = pendingFiles.filter(f => f.type === 'video');
    return videoFiles.length > 0 && videoFiles.every(f => selectedPendingIds.includes(f.id));
  }, [pendingFiles, selectedPendingIds]);

  return (
    <div className="glass-panel flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
      <span className="mr-1 text-sm text-muted-foreground">Auswahl:</span>
      
      {imageCount > 0 && (
        <Button
          size="sm"
          variant={allImagesSelected ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => onSelectType('image')}
        >
          <ImageFormatIcon className="h-3.5 w-3.5" />
          Bilder ({imageCount})
        </Button>
      )}
      
      {videoCount > 0 && (
        <Button
          size="sm"
          variant={allVideosSelected ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => onSelectType('video')}
        >
          <VideoTimelineIcon className="h-3.5 w-3.5" />
          Videos ({videoCount})
        </Button>
      )}

      {selectedPendingIds.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearSelection}
        >
          <CloseSelectionIcon className="h-3.5 w-3.5" />
          Auswahl aufheben
        </Button>
      )}
    </div>
  );
};
