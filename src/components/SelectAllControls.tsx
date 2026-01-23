import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Image, Film, X } from 'lucide-react';
import { ConvertibleFile, FileType } from '@/types/converter';

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
    <div className="flex items-center gap-2 px-1">
      <span className="text-sm text-muted-foreground mr-1">Alle auswählen:</span>
      
      {imageCount > 0 && (
        <Button
          size="sm"
          variant={allImagesSelected ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => onSelectType('image')}
        >
          <Image className="h-3.5 w-3.5" />
          Bilder ({imageCount})
        </Button>
      )}
      
      {videoCount > 0 && (
        <Button
          size="sm"
          variant={allVideosSelected ? "default" : "outline"}
          className="h-7 gap-1.5 text-xs"
          onClick={() => onSelectType('video')}
        >
          <Film className="h-3.5 w-3.5" />
          Videos ({videoCount})
        </Button>
      )}

      {selectedPendingIds.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearSelection}
        >
          <X className="h-3.5 w-3.5" />
          Auswahl aufheben
        </Button>
      )}
    </div>
  );
};
