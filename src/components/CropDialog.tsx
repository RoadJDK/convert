import { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CropArea, ConvertibleFile, TrimRange } from '@/types/converter';
import { Crop as CropIcon, Play, Pause, Link2, Unlink2 } from 'lucide-react';

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

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const CropDialog = ({ file, open, onClose, onApply }: CropDialogProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [aspectLocked, setAspectLocked] = useState(true);
  const [cropAspectLocked, setCropAspectLocked] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imgSrc, setImgSrc] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  
  // Video-specific state
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const prevTrimRef = useRef<[number, number]>([0, 0]);

  // Load image or video
  useEffect(() => {
    if (file && open) {
      if (file.type === 'image') {
        const reader = new FileReader();
        reader.onload = () => {
          setImgSrc(reader.result as string);
        };
        reader.readAsDataURL(file.file);
        setVideoSrc('');
      } else {
        const url = URL.createObjectURL(file.file);
        setVideoSrc(url);
        setImgSrc('');
        return () => URL.revokeObjectURL(url);
      }
    }
  }, [file, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsPlaying(false);
    }
  }, [open]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setOriginalDimensions({ width: naturalWidth, height: naturalHeight });
    setDimensions({ width: naturalWidth, height: naturalHeight });
    
    const crop = centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight);
    setCrop(crop);
  }, []);

  const onVideoLoad = useCallback(() => {
    if (videoRef.current) {
      const { videoWidth, videoHeight, duration } = videoRef.current;
      setOriginalDimensions({ width: videoWidth, height: videoHeight });
      setDimensions({ width: videoWidth, height: videoHeight });
      setVideoDuration(duration);
      setTrimStart(0);
      setTrimEnd(duration);
      prevTrimRef.current = [0, duration];
      
      const crop = centerAspectCrop(videoWidth, videoHeight, videoWidth / videoHeight);
      setCrop(crop);
    }
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      // Clamp preview to trim range
      if (trimEnd > 0 && t > trimEnd) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = trimEnd;
        setCurrentTime(trimEnd);
        return;
      }
      if (t < trimStart) {
        videoRef.current.currentTime = trimStart;
        setCurrentTime(trimStart);
        return;
      }
      setCurrentTime(t);
    }
  }, [trimEnd, trimStart]);

  const handleTrimRangeChange = useCallback((value: number[]) => {
    if (!Array.isArray(value) || value.length < 2) return;

    const minGap = 0.1;
    let start = value[0];
    let end = value[1];

    // Ensure ordering and minimum gap
    if (start > end) [start, end] = [end, start];
    if (end - start < minGap) {
      end = Math.min(videoDuration, start + minGap);
      start = Math.max(0, end - minGap);
    }

    const [prevStart, prevEnd] = prevTrimRef.current;
    const startChanged = Math.abs(start - prevStart) >= Math.abs(end - prevEnd);
    const seekTo = startChanged ? start : end;

    setTrimStart(start);
    setTrimEnd(end);
    prevTrimRef.current = [start, end];

    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }, [videoDuration]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Always start playback within trim range
        if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime > trimEnd) {
          videoRef.current.currentTime = trimStart;
          setCurrentTime(trimStart);
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, trimEnd, trimStart]);

  const handleDimensionChange = (key: 'width' | 'height', value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) return;

    if (aspectLocked) {
      const ratio = originalDimensions.width / originalDimensions.height;
      if (key === 'width') {
        setDimensions({ width: num, height: Math.round(num / ratio) });
      } else {
        setDimensions({ width: Math.round(num * ratio), height: num });
      }
    } else {
      setDimensions((prev) => ({ ...prev, [key]: num }));
    }
  };

  const applyCropAspectFromDimensions = useCallback(() => {
    if (originalDimensions.width <= 0 || originalDimensions.height <= 0) return;
    const aspect = dimensions.width > 0 && dimensions.height > 0
      ? dimensions.width / dimensions.height
      : originalDimensions.width / originalDimensions.height;
    const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, aspect);
    setCrop(c);
  }, [dimensions.height, dimensions.width, originalDimensions.height, originalDimensions.width]);

  const handleApply = () => {
    let cropArea: CropArea | undefined;
    let trimRange: TrimRange | undefined;

    // Get crop area from either image or video
    if (completedCrop) {
      if (file?.type === 'image' && imgRef.current) {
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
        cropArea = {
          x: Math.round(completedCrop.x * scaleX),
          y: Math.round(completedCrop.y * scaleY),
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY),
        };
      } else if (file?.type === 'video' && videoRef.current) {
        const scaleX = videoRef.current.videoWidth / videoRef.current.clientWidth;
        const scaleY = videoRef.current.videoHeight / videoRef.current.clientHeight;
        cropArea = {
          x: Math.round(completedCrop.x * scaleX),
          y: Math.round(completedCrop.y * scaleY),
          width: Math.round(completedCrop.width * scaleX),
          height: Math.round(completedCrop.height * scaleY),
        };
      }
    }

    // Get trim range for videos
    if (file?.type === 'video' && (trimStart > 0 || trimEnd < videoDuration)) {
      trimRange = { start: trimStart, end: trimEnd };
    }

    onApply(cropArea, dimensions, trimRange);
    onClose();
  };

  const handleReset = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setDimensions(originalDimensions);
    setTrimStart(0);
    setTrimEnd(videoDuration);
    prevTrimRef.current = [0, videoDuration];
  };

  if (!file) return null;

  const isVideo = file.type === 'video';
  const cropAspect = cropAspectLocked && dimensions.width > 0 && dimensions.height > 0
    ? dimensions.width / dimensions.height
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            {isVideo ? 'Video bearbeiten' : 'Bild bearbeiten'}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
          {/* Preview */}
          <div className="space-y-3">
            <div className="flex justify-center bg-muted/30 rounded-lg p-3 sm:p-4 max-h-[55vh] overflow-auto">
              {imgSrc && !isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={cropAspect}
                  className="max-h-[50vh]"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Vorschau zum Zuschneiden"
                    onLoad={onImageLoad}
                    className="max-h-[50vh] object-contain"
                  />
                </ReactCrop>
              )}
              {videoSrc && isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={cropAspect}
                  className="max-h-[50vh]"
                >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={onVideoLoad}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="max-h-[50vh] object-contain"
                    muted
                    playsInline
                  />
                </ReactCrop>
              )}
            </div>

            {/* Single trim timeline for videos (start/end only) */}
            {isVideo && videoDuration > 0 && (
              <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlayPause}
                    className="h-8 w-8 p-0"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1">
                    <Slider
                      value={[trimStart, trimEnd]}
                      onValueChange={handleTrimRangeChange}
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Start: {formatTime(trimStart)}</span>
                  <span>Aktuell: {formatTime(currentTime)}</span>
                  <span>Ende: {formatTime(trimEnd)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Dauer: {formatTime(Math.max(0, trimEnd - trimStart))} von {formatTime(videoDuration)}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Zielgröße (px)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAspectLocked(!aspectLocked)}
                  className={aspectLocked ? 'text-primary' : 'text-muted-foreground'}
                  title={aspectLocked ? 'Seitenverhältnis gesperrt' : 'Seitenverhältnis frei'}
                >
                  {aspectLocked ? <Link2 className="h-4 w-4" /> : <Unlink2 className="h-4 w-4" />}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Breite</Label>
                  <Input
                    type="number"
                    value={dimensions.width}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Höhe</Label>
                  <Input
                    type="number"
                    value={dimensions.height}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Original: {originalDimensions.width} × {originalDimensions.height} px
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Crop an Ziel-Verhältnis</Label>
                <Button
                  variant={cropAspectLocked ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const next = !cropAspectLocked;
                    setCropAspectLocked(next);
                    if (next) applyCropAspectFromDimensions();
                  }}
                >
                  {cropAspectLocked ? 'An' : 'Aus'}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={applyCropAspectFromDimensions}
              >
                Crop anpassen
              </Button>
              <p className="text-xs text-muted-foreground">
                Wenn „An“, wird das Crop-Tool auf das Verhältnis deiner Zielgröße gesperrt.
              </p>
            </div>

            {completedCrop && (
              <p className="text-xs text-muted-foreground">
                Aktueller Ausschnitt: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Zurücksetzen
          </Button>
          <Button onClick={handleApply}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
