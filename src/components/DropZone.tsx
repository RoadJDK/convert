import { useCallback, useState } from 'react';
import { Upload, Image, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_IMAGE_FORMATS, SUPPORTED_VIDEO_FORMATS, getFileType } from '@/types/converter';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
}

export const DropZone = ({ onFilesAdded }: DropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => getFileType(file) !== null
      );

      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []).filter(
        (file) => getFileType(file) !== null
      );

      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      
      // Reset input
      e.target.value = '';
    },
    [onFilesAdded]
  );

  const acceptedFormats = [...SUPPORTED_IMAGE_FORMATS, ...SUPPORTED_VIDEO_FORMATS].join(',');

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all duration-300',
        'bg-card/50 hover:bg-card',
        isDragOver
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-border hover:border-primary/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept={acceptedFormats}
        onChange={handleFileInput}
        className="absolute inset-0 cursor-pointer opacity-0"
      />

      <div
        className={cn(
          'mb-4 rounded-full p-4 transition-all duration-300',
          isDragOver ? 'bg-primary/20' : 'bg-secondary'
        )}
      >
        <Upload
          className={cn(
            'h-8 w-8 transition-colors',
            isDragOver ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </div>

      <h3 className="mb-2 text-lg font-semibold text-foreground">
        Dateien hierher ziehen
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        oder klicken um auszuwählen
      </p>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          <span>PNG, JPG, GIF, BMP → WebP</span>
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4" />
          <span>MP4, MOV, AVI → WebM</span>
        </div>
      </div>
    </div>
  );
};
