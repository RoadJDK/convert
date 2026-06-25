import { useCallback, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SUPPORTED_IMAGE_FORMATS, SUPPORTED_PDF_FORMATS, SUPPORTED_VIDEO_FORMATS, getFileType } from '@/types/converter';
import { BatchFilesIcon, ImageFormatIcon, ImportStackIcon, VideoTimelineIcon } from '@/components/icons/MediaConvertIcons';

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
      'shrink-0 rounded-[var(--ms-radius-card-small)] border',
      compact ? 'p-3' : 'p-4',
      isDragOver
        ? 'border-[var(--ms-accent)] bg-[var(--ms-accent-tint)] text-[var(--ms-accent)]'
        : 'border-[var(--ms-hairline)] bg-[var(--ms-cream)] text-[var(--ms-ink-muted)]'
    )}
  >
    <ImportStackIcon
      className={cn(
        compact ? 'h-5 w-5' : 'h-8 w-8',
        isDragOver ? 'text-[var(--ms-accent)]' : 'text-[var(--ms-ink-muted)]'
      )}
    />
  </div>
);

const SupportedFormatList = ({ compact = false }: DropZoneVisualProps) => (
  <div
    className={cn(
      'grid grid-cols-3 gap-2 text-xs text-[var(--ms-ink-muted)]',
      compact ? 'mt-3' : ''
    )}
  >
    <div className="flex min-w-0 items-center gap-1.5 rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] px-2 py-2">
      <ImageFormatIcon className="h-4 w-4" />
      <span className="truncate">Bild</span>
    </div>
    <div className="flex min-w-0 items-center gap-1.5 rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] px-2 py-2">
      <VideoTimelineIcon className="h-4 w-4" />
      <span className="truncate">Video</span>
    </div>
    <div className="flex min-w-0 items-center gap-1.5 rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] px-2 py-2">
      <BatchFilesIcon className="h-4 w-4" />
      <span>PDF</span>
    </div>
  </div>
);

export const DropZone = ({ hasFiles = false, onFilesAdded }: DropZoneProps) => {
  const inputId = useId();
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<File[]>([]);

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

      const incomingFiles = Array.from(e.dataTransfer.files);
      const droppedFiles = incomingFiles.filter((file) => getFileType(file) !== null);
      const rejected = incomingFiles.filter((file) => getFileType(file) === null);
      setRejectedFiles(rejected);

      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded, resetDragState]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const incomingFiles = Array.from(e.target.files || []);
      const selectedFiles = incomingFiles.filter((file) => getFileType(file) !== null);
      const rejected = incomingFiles.filter((file) => getFileType(file) === null);
      setRejectedFiles(rejected);

      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      
      // Reset input
      e.target.value = '';
    },
    [onFilesAdded]
  );

  const acceptedFormats = [...SUPPORTED_IMAGE_FORMATS, ...SUPPORTED_VIDEO_FORMATS, ...SUPPORTED_PDF_FORMATS].join(',');
  const rejectedSummary = rejectedFiles.length > 0
    ? `${rejectedFiles.length} Datei${rejectedFiles.length !== 1 ? 'en' : ''} nicht unterstützt: ${rejectedFiles
      .slice(0, 2)
      .map((file) => file.name)
      .join(', ')}${rejectedFiles.length > 2 ? ' ...' : ''}`
    : null;

  return (
    <label
      htmlFor={inputId}
      data-testid="drop-zone"
      data-compact={hasFiles ? 'true' : 'false'}
      className={cn(
        'relative block cursor-pointer overflow-hidden rounded-[var(--ms-radius-card)] border border-dashed bg-[var(--ms-cream)] outline-none focus-within:border-[var(--ms-accent)] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background motion-safe:transition-[min-height,border-color,background-color,box-shadow] motion-safe:duration-300 motion-safe:ease-out',
        hasFiles ? 'min-h-[144px]' : 'min-h-[264px]',
        isDragOver
          ? 'border-[var(--ms-accent)] bg-[var(--ms-accent-tint)]'
          : 'border-[var(--ms-hairline)]'
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

      {rejectedSummary && (
        <div
          role="status"
          data-testid="unsupported-file-notice"
          className="absolute left-4 right-4 top-4 z-10 rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] px-3 py-2 text-xs font-medium text-[var(--ms-ink)] shadow-[var(--ms-shadow-panel)]"
        >
          {rejectedSummary}
        </div>
      )}

      <div
        aria-hidden={hasFiles}
        className={cn(
          'absolute inset-0 flex flex-col justify-between p-4 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
          hasFiles ? 'pointer-events-none opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <DropZoneIcon isDragOver={isDragOver} />
          <span className="ms-chip">lokal</span>
        </div>

        <div className="min-w-0">
          <h3 className="ms-h4 text-[var(--ms-ink)]">Klicken oder Dateien hier ablegen</h3>
          <p className="mb-4 mt-2 text-sm leading-relaxed text-[var(--ms-ink-muted)]">
            Ein Foto, mehrere Fotos, Videos, PDFs oder alles gemischt.
          </p>

          <SupportedFormatList />
        </div>
      </div>

      <div
        aria-hidden={!hasFiles}
        className={cn(
          'absolute inset-0 flex items-stretch p-4 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
          hasFiles ? 'opacity-100 delay-75 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
        )}
      >
        <div className="flex w-full flex-col justify-between gap-3">
          <DropZoneIcon compact isDragOver={isDragOver} />

          <div className="min-w-0">
            <div>
              <h3 className="text-base font-semibold text-[var(--ms-ink)]">Weitere Dateien wählen</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ms-ink-muted)]">
                Neue Dateien werden automatisch einsortiert.
              </p>
            </div>
          </div>
        </div>
      </div>
    </label>
  );
};
