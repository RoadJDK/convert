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
      setCleanupMaskStrokes([]);
      setVideoRotation(0);
      stopPlayback();
      resetAspectInputs();
    }
  }, [open, resetAspectInputs, stopPlayback]);

  const isCleanupMode = mode === "cleanup";

  useEffect(() => {
    if (!open || !isCleanupMode || !file) return;

    const existingStrokes = file.cleanupMask?.strokes ?? [];
    setCleanupMaskStrokes(existingStrokes);
    setCleanupBrushRadius(existingStrokes[0]?.brushRadius ?? DEFAULT_CLEANUP_BRUSH_RADIUS);
    setCleanupSelectionMode(existingStrokes.length > 0 ? "freehand" : "rectangle");
  }, [file, isCleanupMode, open]);

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
      const strokes = cleanupMaskStrokes.filter((stroke) => stroke.points.length > 0);
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
    } else if (isCleanupMode && crop && crop.unit === '%' && file?.type === 'image') {
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
    setCleanupMaskStrokes((previous) => {
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
  }, []);

  const handleCleanupPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isCleanupMode || cleanupSelectionMode !== "freehand") return;

    event.preventDefault();
    const point = getCleanupMaskPoint(event);
    cleanupPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setCleanupMaskStrokes((previous) => [
      ...previous,
      {
        brushRadius: cleanupBrushRadius,
        points: [point],
      },
    ]);
  }, [cleanupBrushRadius, cleanupSelectionMode, getCleanupMaskPoint, isCleanupMode]);

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
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CropFrameIcon className="h-5 w-5" />
            {isCleanupMode ? 'Bereich bereinigen' : isVideo ? 'Video bearbeiten' : 'Bild bearbeiten'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isCleanupMode
              ? 'Bereich für lokale Objekt- oder Watermark-Bereinigung markieren.'
              : 'Ausschnitt, Zielgröße und bei Videos den Trim-Bereich einstellen.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px] overflow-auto">
          {/* Preview */}
          <div className="space-y-2">
            <div className="flex justify-center bg-muted/30 rounded-lg p-2 max-h-[40vh] overflow-hidden">
              {imgSrc && !isVideo && showFreehandCleanup && (
                <div className="relative inline-block max-h-[38vh] select-none touch-none">
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Vorschau zum Maskieren"
                    onLoad={onImageLoad}
                    draggable={false}
                    className="max-h-[38vh] object-contain"
                  />
                  <svg
                    aria-label="Freihandmaske zeichnen"
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
                        stroke="rgba(59, 130, 246, 0.78)"
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
                  className="max-h-[38vh]"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Vorschau zum Zuschneiden"
                    onLoad={onImageLoad}
                    className="max-h-[38vh] object-contain"
                  />
                </ReactCrop>
              )}
              {videoSrc && isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={handleCropChange}
                  onComplete={handleCropComplete}
                  aspect={cropAspect}
                  className="max-h-[38vh]"
                >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={onVideoLoad}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="max-h-[38vh] object-contain"
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

          <div className="space-y-3">
            {isCleanupMode ? (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-sm text-muted-foreground">
                  Markiere nur eigene oder autorisierte Inhalte. Die lokale Inpainting-Stufe rekonstruiert maskierte Pixel aus der Umgebung, ohne vollständige Entfernungsgarantie.
                </p>
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
                  <ToggleGroupItem value="rectangle" aria-label="Rechteckmaske">
                    Rechteck
                  </ToggleGroupItem>
                  <ToggleGroupItem value="freehand" aria-label="Freihandmaske">
                    Freihand
                  </ToggleGroupItem>
                </ToggleGroup>
                {cleanupSelectionMode === "freehand" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pinsel</span>
                      <span className="text-xs font-medium">{Math.round(cleanupBrushRadius * 100)}%</span>
                    </div>
                    <Slider
                      aria-label="Pinselgröße"
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
                      className="h-8 w-full text-xs"
                      disabled={cleanupMaskStrokes.length === 0}
                      onClick={() => setCleanupMaskStrokes([])}
                    >
                      Maske leeren
                    </Button>
                  </div>
                )}
              </div>
            ) : (
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

        <DialogFooter className="flex-shrink-0 gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleApply}>
            {isCleanupMode ? 'Bereich verwenden' : 'Anwenden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
