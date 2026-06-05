import { useCallback, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SUPPORTED_IMAGE_FORMATS, SUPPORTED_VIDEO_FORMATS, getFileType } from '@/types/converter';
import { ImageFormatIcon, ImportStackIcon, VideoTimelineIcon } from '@/components/icons/MediaConvertIcons';

interface DropZoneProps {
  hasFiles?: boolean;
  onFilesAdded: (files: File[]) => void;
}

interface DropZoneVisualProps {
  compact?: boolean;
  isDragOver?: boolean;
}

const DropZoneIcon = ({ compact = false, isDragOver = false }: DropZoneVisualProps) => (
  <div
    className={cn(
      'shrink-0 rounded-xl border border-white/10',
      compact ? 'mb-0 p-3' : 'mb-4 p-4',
      isDragOver ? 'bg-primary/20 text-primary' : 'bg-white/[0.055] text-muted-foreground'
    )}
  >
    <ImportStackIcon
      className={cn(
        compact ? 'h-5 w-5' : 'h-8 w-8',
        isDragOver ? 'text-primary' : 'text-muted-foreground'
      )}
    />
  </div>
);

const SupportedFormatList = ({ compact = false }: DropZoneVisualProps) => (
  <div
    className={cn(
      'flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground',
      compact ? 'mt-3 sm:mt-0 sm:justify-end' : ''
    )}
  >
    <div className="flex items-center gap-2">
      <ImageFormatIcon className="h-4 w-4" />
      <span>WebP, PNG, JPG, SVG, HEIC, TIFF</span>
    </div>
    <div className="flex items-center gap-2">
      <VideoTimelineIcon className="h-4 w-4" />
      <span>MP4, WebM, MOV, MKV</span>
    </div>
  </div>
);

export const DropZone = ({ hasFiles = false, onFilesAdded }: DropZoneProps) => {
  const inputId = useId();
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      resetDragState();

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => getFileType(file) !== null
      );

      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded, resetDragState]
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
    <label
      htmlFor={inputId}
      data-testid="drop-zone"
      data-compact={hasFiles ? 'true' : 'false'}
      className={cn(
        'glass-panel relative block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed text-center motion-safe:transition-[height,border-color,background-color,box-shadow] motion-safe:duration-300 motion-safe:ease-out',
        hasFiles ? 'h-[118px] sm:text-left' : 'h-[270px]',
        isDragOver
          ? 'border-primary bg-primary/10'
          : 'border-white/10'
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        type="file"
        multiple
        accept={acceptedFormats}
        onChange={handleFileInput}
        className="sr-only"
      />

      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center p-8 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out sm:p-12',
          hasFiles ? 'pointer-events-none opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
        )}
      >
        <DropZoneIcon isDragOver={isDragOver} />

        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-foreground">Dateien hierher ziehen</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            oder klicken und mehrere Bilder oder Videos auswählen
          </p>

          <SupportedFormatList />
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center p-4 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out sm:p-5',
          hasFiles ? 'opacity-100 delay-75 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
        )}
      >
        <div className="flex w-full items-center justify-center gap-3 sm:justify-start">
          <DropZoneIcon compact isDragOver={isDragOver} />

          <div className="min-w-0 sm:flex sm:flex-1 sm:items-center sm:justify-between sm:gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Weitere Dateien hinzufügen</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                oder klicken und mehrere Bilder oder Videos auswählen
              </p>
            </div>

            <SupportedFormatList compact />
          </div>
        </div>
      </div>
    </label>
  );
};
