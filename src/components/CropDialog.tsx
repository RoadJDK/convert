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
import { CropArea, ConvertibleFile, TrimRange } from '@/types/converter';
import { ResizeControls } from '@/components/crop-dialog/ResizeControls';
import { VideoTrimControls } from '@/components/crop-dialog/VideoTrimControls';
import { useResizeController } from '@/hooks/useResizeController';
import { useVideoTrimController } from '@/hooks/useVideoTrimController';
import { centerAspectCrop, normalizeRenderedPixelCrop, resolveCropAreaToSourcePixels } from '@/lib/cropMath';
import { readDisplayableImageAsDataUrl } from '@/lib/displayableImage';
import { CropFrameIcon } from '@/components/icons/MediaConvertIcons';

interface CropDialogProps {
  file: ConvertibleFile | null;
  open: boolean;
  onClose: () => void;
  onApply: (
    cropArea: CropArea | undefined, 
    dimensions?: { width: number; height: number },
    trimRange?: TrimRange
  ) => void;
}

const MIN_DRAWN_CROP_SIZE_PX = 4;

const isMeaningfulCrop = (crop: PixelCrop) =>
  crop.width >= MIN_DRAWN_CROP_SIZE_PX && crop.height >= MIN_DRAWN_CROP_SIZE_PX;

export const CropDialog = ({ file, open, onClose, onApply }: CropDialogProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
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
  const [imgSrc, setImgSrc] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
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
      stopPlayback();
      resetAspectInputs();
    }
  }, [open, resetAspectInputs, stopPlayback]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setMediaDimensions({ width: naturalWidth, height: naturalHeight });
    
    const crop = centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight);
    setCrop(crop);
  }, [setMediaDimensions]);

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

    // Get crop area from either image or video
    if (completedCrop) {
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
    }

    // Get trim range for videos
    if (file?.type === 'video' && (trimStart > 0 || trimEnd < videoDuration)) {
      trimRange = { start: trimStart, end: trimEnd };
    }

    onApply(cropArea, dimensions, trimRange);
    onClose();
  };

  // Reset dimensions only
  const handleResetDimensions = useCallback(() => {
    resetDimensions();
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [resetDimensions]);

  if (!file) return null;

  const isVideo = file.type === 'video';
  const cropAspect = cropAspectLocked && dimensions.width > 0 && dimensions.height > 0
    ? dimensions.width / dimensions.height
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CropFrameIcon className="h-5 w-5" />
            {isVideo ? 'Video bearbeiten' : 'Bild bearbeiten'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ausschnitt, Zielgröße und bei Videos den Trim-Bereich einstellen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px] overflow-auto">
          {/* Preview */}
          <div className="space-y-2">
            <div className="flex justify-center bg-muted/30 rounded-lg p-2 max-h-[40vh] overflow-hidden">
              {imgSrc && !isVideo && (
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

            {isVideo && (
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

        <DialogFooter className="flex-shrink-0 gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleApply}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
