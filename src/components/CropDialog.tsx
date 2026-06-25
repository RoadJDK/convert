import { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PercentCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CleanupMask, CleanupMaskPoint, CleanupMaskStroke, CropArea, ConvertibleFile, TrimRange, VideoRotation } from '@/types/converter';
import { ResizeControls } from '@/components/crop-dialog/ResizeControls';
import { VideoRotationControls } from '@/components/crop-dialog/VideoRotationControls';
import { VideoTrimControls } from '@/components/crop-dialog/VideoTrimControls';
import { useResizeController } from '@/hooks/useResizeController';
import { useVideoTrimController } from '@/hooks/useVideoTrimController';
import { centerAspectCrop, normalizeRenderedPixelCrop, resolveCropAreaToSourcePixels } from '@/lib/cropMath';
import { readDisplayableImageAsDataUrl } from '@/lib/displayableImage';
import { CropFrameIcon } from '@/components/icons/MediaConvertIcons';

interface CropDialogProps {
  file: ConvertibleFile | null;
  open: boolean;
  mode?: "crop" | "cleanup";
  onClose: () => void;
  onApply: (
    cropArea: CropArea | undefined, 
    dimensions?: { width: number; height: number },
    trimRange?: TrimRange,
    videoRotation?: VideoRotation,
    cleanupMask?: CleanupMask,
  ) => void;
}

const MIN_DRAWN_CROP_SIZE_PX = 4;

const isMeaningfulCrop = (crop: PixelCrop) =>
  crop.width >= MIN_DRAWN_CROP_SIZE_PX && crop.height >= MIN_DRAWN_CROP_SIZE_PX;

const areaToPercentCrop = (area: CropArea): PercentCrop => ({
  unit: "%",
  x: area.x * 100,
  y: area.y * 100,
  width: area.width * 100,
  height: area.height * 100,
});

const DEFAULT_CLEANUP_BRUSH_RADIUS = 0.08;

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export const CropDialog = ({ file, open, mode = "crop", onClose, onApply }: CropDialogProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [cleanupSelectionMode, setCleanupSelectionMode] = useState<"rectangle" | "freehand">("rectangle");
  const [cleanupBrushRadius, setCleanupBrushRadius] = useState(DEFAULT_CLEANUP_BRUSH_RADIUS);
  const [cleanupMaskStrokes, setCleanupMaskStrokes] = useState<CleanupMaskStroke[]>([]);
  const {
    aspectHeight,
    aspectLocked,
    aspectWidth,
    cropAspectLocked,
    dimensions,
    originalDimensions,
    handleAspectHeightChange,
    handleAspectWidthChange,
    handleDimensionChange,
    resetAspectInputs,
    resetDimensions,
    setDimensions,
    setMediaDimensions,
    toggleAspectLock,
    toggleCropAspect,
  } = useResizeController({ onCropChange: setCrop });
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupPointerIdRef = useRef<number | null>(null);
  const cleanupMaskStrokesRef = useRef<CleanupMaskStroke[]>([]);
  const [imgSrc, setImgSrc] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [videoRotation, setVideoRotation] = useState<VideoRotation>(0);
  const {
    currentTime,
    handlePositionChange,
    handleRangeChange,
    handleVideoTimeUpdate,
    isPlaying,
    onVideoLoad,
    resetTrim,
    stopPlayback,
    togglePlayPause,
    trimEnd,
    trimStart,
    videoDuration,
  } = useVideoTrimController({
    videoRef,
    onCropChange: setCrop,
    onMediaDimensions: setMediaDimensions,
  });

  const setCleanupMaskStrokesSync = useCallback((strokes: CleanupMaskStroke[]) => {
    cleanupMaskStrokesRef.current = strokes;
    setCleanupMaskStrokes(strokes);
  }, []);

  const updateCleanupMaskStrokesSync = useCallback((updater: (previous: CleanupMaskStroke[]) => CleanupMaskStroke[]) => {
    const next = updater(cleanupMaskStrokesRef.current);
    cleanupMaskStrokesRef.current = next;
    setCleanupMaskStrokes(next);
  }, []);

  // Load image or video
  useEffect(() => {
    let cancelled = false;
    let videoUrl: string | undefined;

    if (file && open) {
      if (file.type === 'image') {
        setImgSrc('');
        setVideoSrc('');
        void readDisplayableImageAsDataUrl(file.file)
          .then((src) => {
            if (!cancelled) {
              setImgSrc(src);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setImgSrc('');
            }
          });
      } else {
        videoUrl = URL.createObjectURL(file.file);
        setVideoSrc(videoUrl);
        setImgSrc('');
        setVideoRotation(file.videoRotation ?? 0);
      }
    }

    return () => {
      cancelled = true;
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [file, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCleanupSelectionMode("rectangle");
      setCleanupBrushRadius(DEFAULT_CLEANUP_BRUSH_RADIUS);
      setCleanupMaskStrokesSync([]);
      setVideoRotation(0);
      stopPlayback();
      resetAspectInputs();
    }
  }, [open, resetAspectInputs, setCleanupMaskStrokesSync, stopPlayback]);

  const isCleanupMode = mode === "cleanup";

  useEffect(() => {
    if (!open || !isCleanupMode || !file) return;

    const existingStrokes = file.cleanupMask?.strokes ?? [];
    setCleanupMaskStrokesSync(existingStrokes);
    setCleanupBrushRadius(existingStrokes[0]?.brushRadius ?? DEFAULT_CLEANUP_BRUSH_RADIUS);
    setCleanupSelectionMode(existingStrokes.length > 0 ? "freehand" : "rectangle");
  }, [file, isCleanupMode, open, setCleanupMaskStrokesSync]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setMediaDimensions({ width: naturalWidth, height: naturalHeight });

    if (isCleanupMode) {
      if (cleanupSelectionMode === "rectangle") {
        setCrop(areaToPercentCrop(file?.cleanupArea ?? { x: 0.62, y: 0.58, width: 0.28, height: 0.28 }));
      } else {
        setCrop(undefined);
        setCompletedCrop(undefined);
      }
      return;
    }
    
    const crop = centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight);
    setCrop(crop);
  }, [cleanupSelectionMode, file?.cleanupArea, isCleanupMode, setMediaDimensions]);

  // When crop is completed (mouse released), sync dimensions and aspect ratio
  const handleCropChange = useCallback((pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    if (!isMeaningfulCrop(pixelCrop)) {
      return;
    }

    setCrop(percentCrop);
  }, []);

  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c);

    if (file?.type === 'image' && imgRef.current) {
      const scaledCrop = resolveCropAreaToSourcePixels(
        normalizeRenderedPixelCrop(
          c,
          { width: imgRef.current.width, height: imgRef.current.height },
        ),
        { width: imgRef.current.naturalWidth, height: imgRef.current.naturalHeight },
      );
      setDimensions({ width: scaledCrop.width, height: scaledCrop.height });
    } else if (file?.type === 'video' && videoRef.current) {
      const scaledCrop = resolveCropAreaToSourcePixels(
        normalizeRenderedPixelCrop(
          c,
          { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight },
        ),
        { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight },
      );
      setDimensions({ width: scaledCrop.width, height: scaledCrop.height });
    }
  }, [file?.type, setDimensions]);

  const handleApply = () => {
    let cropArea: CropArea | undefined;
    let trimRange: TrimRange | undefined;
    let cleanupMask: CleanupMask | undefined;

    // Get crop area from either image or video
    if (isCleanupMode && cleanupSelectionMode === "freehand") {
      const strokes = cleanupMaskStrokesRef.current.filter((stroke) => stroke.points.length > 0);
      cleanupMask = strokes.length > 0 ? { strokes } : undefined;
    } else if (completedCrop) {
      if (file?.type === 'image' && imgRef.current) {
        cropArea = normalizeRenderedPixelCrop(
          completedCrop,
          { width: imgRef.current.width, height: imgRef.current.height },
        );
      } else if (file?.type === 'video' && videoRef.current) {
        cropArea = normalizeRenderedPixelCrop(
          completedCrop,
          { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight },
        );
      }
    } else if (isCleanupMode && crop && crop.unit === '%' && (file?.type === 'image' || file?.type === 'video')) {
      cropArea = {
        x: Number(((crop.x ?? 0) / 100).toFixed(6)),
        y: Number(((crop.y ?? 0) / 100).toFixed(6)),
        width: Number(((crop.width ?? 0) / 100).toFixed(6)),
        height: Number(((crop.height ?? 0) / 100).toFixed(6)),
      };
    }

    // Get trim range for videos
    if (!isCleanupMode && file?.type === 'video' && (trimStart > 0 || trimEnd < videoDuration)) {
      trimRange = { start: trimStart, end: trimEnd };
    }

    onApply(
      cropArea,
      isCleanupMode ? undefined : dimensions,
      trimRange,
      !isCleanupMode && isVideo && videoRotation !== 0 ? videoRotation : undefined,
      cleanupMask,
    );
    onClose();
  };

  const getCleanupMaskPoint = useCallback((event: React.PointerEvent<SVGSVGElement>): CleanupMaskPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();

    return {
      x: clampUnit((event.clientX - bounds.left) / bounds.width),
      y: clampUnit((event.clientY - bounds.top) / bounds.height),
    };
  }, []);

  const appendCleanupMaskPoint = useCallback((point: CleanupMaskPoint) => {
    updateCleanupMaskStrokesSync((previous) => {
      if (previous.length === 0) return previous;

      const next = [...previous];
      const lastStroke = next[next.length - 1];
      const lastPoint = lastStroke.points[lastStroke.points.length - 1];
      if (lastPoint && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 0.004) {
        return previous;
      }

      next[next.length - 1] = {
        ...lastStroke,
        points: [...lastStroke.points, point],
      };
      return next;
    });
  }, [updateCleanupMaskStrokesSync]);

  const handleCleanupPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isCleanupMode || cleanupSelectionMode !== "freehand") return;

    event.preventDefault();
    const point = getCleanupMaskPoint(event);
    cleanupPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCleanupMaskStrokesSync((previous) => [
      ...previous,
      {
        brushRadius: cleanupBrushRadius,
        points: [point],
      },
    ]);
  }, [cleanupBrushRadius, cleanupSelectionMode, getCleanupMaskPoint, isCleanupMode, updateCleanupMaskStrokesSync]);

  const handleCleanupPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (cleanupPointerIdRef.current !== event.pointerId) return;
    appendCleanupMaskPoint(getCleanupMaskPoint(event));
  }, [appendCleanupMaskPoint, getCleanupMaskPoint]);

  const handleCleanupPointerEnd = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (cleanupPointerIdRef.current !== event.pointerId) return;
    appendCleanupMaskPoint(getCleanupMaskPoint(event));
    cleanupPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [appendCleanupMaskPoint, getCleanupMaskPoint]);

  const handleVideoRotationChange = useCallback((direction: "left" | "right") => {
    setVideoRotation((previous) => {
      const next = ((direction === "right" ? previous + 90 : previous + 270) % 360) as VideoRotation;
      return next;
    });
    setDimensions((previous) =>
      previous.width > 0 && previous.height > 0
        ? { width: previous.height, height: previous.width }
        : previous,
    );
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [setDimensions]);

  const handleVideoRotationReset = useCallback(() => {
    setVideoRotation(0);
    if (originalDimensions.width > 0 && originalDimensions.height > 0) {
      setDimensions(originalDimensions);
    }
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [originalDimensions, setDimensions]);

  const handleVideoLoad = useCallback(() => {
    onVideoLoad();
    if (isCleanupMode) {
      setCrop(areaToPercentCrop(file?.cleanupArea ?? { x: 0.62, y: 0.58, width: 0.28, height: 0.28 }));
      setCompletedCrop(undefined);
    }
  }, [file?.cleanupArea, isCleanupMode, onVideoLoad]);

  // Reset dimensions only
  const handleResetDimensions = useCallback(() => {
    resetDimensions();
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [resetDimensions]);

  if (!file) return null;

  const isVideo = file.type === 'video';
  const showFreehandCleanup = isCleanupMode && !isVideo && cleanupSelectionMode === "freehand";
  const cropAspect = !isCleanupMode && cropAspectLocked && dimensions.width > 0 && dimensions.height > 0
    ? dimensions.width / dimensions.height
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex h-[calc(100dvh_-_32px)] max-w-[min(1180px,calc(100vw_-_32px))] grid-rows-none flex-col overflow-hidden border-0 bg-[var(--ms-card)] p-0 sm:rounded-[var(--ms-radius-panel)]">
        <DialogHeader className="flex-shrink-0 border-b border-[var(--ms-hairline)] px-5 py-4 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ms-chip ms-chip-accent">{isCleanupMode ? "Bereinigen" : isVideo ? "Video" : "Bild"}</span>
            <span className="ms-chip">{file.originalName}</span>
          </div>
          <DialogTitle className="mt-2 flex items-center gap-2">
            <CropFrameIcon className="h-5 w-5 text-accent" />
            {isCleanupMode ? 'Bereich bereinigen' : isVideo ? 'Video bearbeiten' : 'Bild bearbeiten'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isCleanupMode
              ? 'Bereich für lokale Logo-, Textstellen- oder Objektbereinigung markieren.'
              : 'Ausschnitt, Zielgrösse und bei Videos den Trim-Bereich einstellen.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col gap-3 bg-[var(--ms-stage)] p-3 text-[var(--ms-on-stage)] sm:p-5">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--ms-radius-card)] bg-[var(--ms-on-stage-row)] p-2">
              {imgSrc && !isVideo && showFreehandCleanup && (
                <div className="relative inline-block max-h-full max-w-full select-none touch-none">
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Vorschau zum Maskieren"
                    onLoad={onImageLoad}
                    draggable={false}
                    className="max-h-[calc(100dvh_-_260px)] max-w-full object-contain"
                  />
                  <svg
                    role="application"
                    tabIndex={0}
                    aria-label="Freihand zeichnen"
                    aria-describedby="cleanup-freehand-instructions"
                    className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                    data-testid="cleanup-freehand-mask"
                    preserveAspectRatio="none"
                    viewBox="0 0 1 1"
                    onPointerCancel={handleCleanupPointerEnd}
                    onPointerDown={handleCleanupPointerDown}
                    onPointerMove={handleCleanupPointerMove}
                    onPointerUp={handleCleanupPointerEnd}
                  >
                    {cleanupMaskStrokes.map((stroke, index) => (
                      <polyline
                        key={`${index}-${stroke.points.length}`}
                        fill="none"
                        points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
                        stroke="var(--ms-accent)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={stroke.brushRadius * 2}
                      />
                    ))}
                  </svg>
                </div>
              )}
              {imgSrc && !isVideo && !showFreehandCleanup && (
                <ReactCrop
                  crop={crop}
                  onChange={handleCropChange}
                  onComplete={handleCropComplete}
                  aspect={cropAspect}
                  className="max-h-full"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Vorschau zum Zuschneiden"
                    onLoad={onImageLoad}
                    className="max-h-[calc(100dvh_-_260px)] max-w-full object-contain"
                  />
                </ReactCrop>
              )}
              {videoSrc && isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={handleCropChange}
                  onComplete={handleCropComplete}
                  aspect={cropAspect}
                  className="max-h-full"
                >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={handleVideoLoad}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="max-h-[calc(100dvh_-_260px)] max-w-full object-contain"
                    style={{
                      transform: videoRotation ? `rotate(${videoRotation}deg)` : undefined,
                      transformOrigin: "center",
                      transition: "transform var(--ms-duration-link) var(--ms-ease-brand)",
                    }}
                    muted
                    playsInline
                  />
                </ReactCrop>
              )}
            </div>

            {!isCleanupMode && isVideo && (
              <VideoTrimControls
                currentTime={currentTime}
                duration={videoDuration}
                isPlaying={isPlaying}
                trimEnd={trimEnd}
                trimStart={trimStart}
                onPositionChange={handlePositionChange}
                onRangeChange={handleRangeChange}
                onReset={resetTrim}
                onTogglePlayback={togglePlayPause}
              />
            )}
          </div>

          <div className="min-h-0 overflow-y-auto border-l border-[var(--ms-hairline)] bg-[var(--ms-cream)] p-4">
            {isCleanupMode ? (
              <div className="space-y-4">
                <div>
                  <span className="ms-chip">Bereich</span>
                  <h3 className="ms-h4 mt-2">Markieren.</h3>
                </div>
                {!isVideo && (
                  <ToggleGroup
                    type="single"
                    value={cleanupSelectionMode}
                    onValueChange={(value) => {
                      if (value === "rectangle" || value === "freehand") {
                        setCleanupSelectionMode(value);
                        setCompletedCrop(undefined);
                        setCrop(value === "rectangle"
                          ? areaToPercentCrop(file.cleanupArea ?? { x: 0.62, y: 0.58, width: 0.28, height: 0.28 })
                          : undefined);
                      }
                    }}
                    className="grid grid-cols-2"
                    size="sm"
                    variant="outline"
                  >
                    <ToggleGroupItem value="rectangle" aria-label="Rechteckmaske" className="h-9 text-xs">
                      Rechteck
                    </ToggleGroupItem>
                    <ToggleGroupItem value="freehand" aria-label="Freihand" className="h-9 text-xs">
                      Freihand
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
                {cleanupSelectionMode === "freehand" && !isVideo && (
                  <div className="space-y-3">
                    <p id="cleanup-freehand-instructions" className="text-xs leading-relaxed text-muted-foreground">
                      Mit Maus, Stift oder Finger über den Bereich zeichnen. Für Tastaturbedienung Rechteck wählen.
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pinsel</span>
                      <span className="text-xs font-medium">{Math.round(cleanupBrushRadius * 100)}%</span>
                    </div>
                    <Slider
                      aria-label="Pinselgrösse"
                      value={[cleanupBrushRadius]}
                      min={0.03}
                      max={0.2}
                      step={0.01}
                      onValueChange={(value) => setCleanupBrushRadius(value[0] ?? DEFAULT_CLEANUP_BRUSH_RADIUS)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full text-xs"
                      disabled={cleanupMaskStrokes.length === 0}
                      onClick={() => setCleanupMaskStrokesSync([])}
                    >
                      Zeichnung löschen
                    </Button>
                  </div>
                )}
                <p className="ms-note">
                  Nur eigene oder autorisierte Inhalte markieren. Die lokale Bereinigung ist eine Hilfe, keine vollständige Entfernungsgarantie.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="ms-chip">Bearbeiten</span>
                  <h3 className="ms-h4 mt-2">Ausschnitt & Grösse.</h3>
                </div>
                <ResizeControls
                  aspectHeight={aspectHeight}
                  aspectLocked={aspectLocked}
                  aspectWidth={aspectWidth}
                  completedCrop={completedCrop}
                  cropAspectLocked={cropAspectLocked}
                  dimensions={dimensions}
                  originalDimensions={originalDimensions}
                  onAspectHeightChange={handleAspectHeightChange}
                  onAspectWidthChange={handleAspectWidthChange}
                  onDimensionChange={handleDimensionChange}
                  onResetDimensions={handleResetDimensions}
                  onToggleAspectLock={toggleAspectLock}
                  onToggleCropAspect={toggleCropAspect}
                />
              </div>
            )}
            {!isCleanupMode && isVideo && (
              <VideoRotationControls
                rotation={videoRotation}
                onReset={handleVideoRotationReset}
                onRotateLeft={() => handleVideoRotationChange("left")}
                onRotateRight={() => handleVideoRotationChange("right")}
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 border-t border-[var(--ms-hairline)] bg-[var(--ms-card)] p-4">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleApply}>
            {isCleanupMode ? 'Bereich übernehmen' : 'Änderung übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
