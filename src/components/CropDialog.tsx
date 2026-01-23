import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { Crop as CropIcon, Play, Pause, Link2, Unlink2, RotateCcw } from 'lucide-react';

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

// Calculate GCD for aspect ratio
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatioString(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '';
  const divisor = gcd(Math.round(width), Math.round(height));
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  // Common ratios
  if ((w === 16 && h === 9) || (w === 32 && h === 18)) return '16:9';
  if ((w === 9 && h === 16) || (w === 18 && h === 32)) return '9:16';
  if ((w === 4 && h === 3) || (w === 8 && h === 6)) return '4:3';
  if ((w === 3 && h === 4) || (w === 6 && h === 8)) return '3:4';
  if (w === h) return '1:1';
  if ((w === 21 && h === 9) || (w === 7 && h === 3)) return '21:9';
  return `${w}:${h}`;
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

  // Custom aspect ratio input
  const [customAspect, setCustomAspect] = useState('');

  // Computed aspect ratio string
  const aspectRatioString = useMemo(() => {
    return getAspectRatioString(dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

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
      setCustomAspect('');
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
      setCurrentTime(0);
      
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

  // Handle trim start change
  const handleTrimStartChange = useCallback((value: number[]) => {
    const newStart = Math.min(value[0], trimEnd - 0.1);
    setTrimStart(Math.max(0, newStart));
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
    }
  }, [trimEnd]);

  // Handle trim end change
  const handleTrimEndChange = useCallback((value: number[]) => {
    const newEnd = Math.max(value[0], trimStart + 0.1);
    setTrimEnd(Math.min(videoDuration, newEnd));
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = newEnd;
      setCurrentTime(newEnd);
    }
  }, [trimStart, videoDuration]);

  // Handle current position change
  const handleCurrentTimeChange = useCallback((value: number[]) => {
    const newTime = Math.max(trimStart, Math.min(trimEnd, value[0]));
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = newTime;
    }
  }, [trimStart, trimEnd]);

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

  // Live dimension change (updates while typing)
  const handleDimensionChange = useCallback((key: 'width' | 'height', value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      // Allow empty or invalid values while typing
      setDimensions(prev => ({ ...prev, [key]: num || 0 }));
      return;
    }

    if (aspectLocked && originalDimensions.width > 0 && originalDimensions.height > 0) {
      const ratio = originalDimensions.width / originalDimensions.height;
      if (key === 'width') {
        setDimensions({ width: num, height: Math.round(num / ratio) });
      } else {
        setDimensions({ width: Math.round(num * ratio), height: num });
      }
    } else {
      setDimensions(prev => ({ ...prev, [key]: num }));
    }

    // Auto-update crop aspect if locked
    if (cropAspectLocked) {
      applyCropAspectFromDimensions();
    }
  }, [aspectLocked, originalDimensions, cropAspectLocked]);

  // Handle aspect ratio input change
  const handleAspectRatioChange = useCallback((value: string) => {
    setCustomAspect(value);
    const match = value.match(/^(\d+):(\d+)$/);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      if (w > 0 && h > 0) {
        const newRatio = w / h;
        const newWidth = dimensions.height * newRatio;
        setDimensions({ width: Math.round(newWidth), height: dimensions.height });
        
        if (cropAspectLocked && originalDimensions.width > 0) {
          const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, newRatio);
          setCrop(c);
        }
      }
    }
  }, [dimensions.height, cropAspectLocked, originalDimensions]);

  const applyCropAspectFromDimensions = useCallback(() => {
    if (originalDimensions.width <= 0 || originalDimensions.height <= 0) return;
    const aspect = dimensions.width > 0 && dimensions.height > 0
      ? dimensions.width / dimensions.height
      : originalDimensions.width / originalDimensions.height;
    const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, aspect);
    setCrop(c);
  }, [dimensions.height, dimensions.width, originalDimensions.height, originalDimensions.width]);

  // Toggle crop aspect lock
  const handleToggleCropAspect = useCallback(() => {
    const next = !cropAspectLocked;
    setCropAspectLocked(next);
    if (next) applyCropAspectFromDimensions();
  }, [cropAspectLocked, applyCropAspectFromDimensions]);

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

  // Reset trim only
  const handleResetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(videoDuration);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [videoDuration]);

  // Reset dimensions only
  const handleResetDimensions = useCallback(() => {
    setDimensions(originalDimensions);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCustomAspect('');
  }, [originalDimensions]);

  // Reset all
  const handleResetAll = useCallback(() => {
    handleResetDimensions();
    if (file?.type === 'video') {
      handleResetTrim();
    }
  }, [file?.type, handleResetDimensions, handleResetTrim]);

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

            {/* Video timeline with 3 separate controls */}
            {isVideo && videoDuration > 0 && (
              <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Video schneiden</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetTrim}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Zurücksetzen
                  </Button>
                </div>

                {/* Start point slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-green-600">Start</Label>
                    <span className="text-xs font-mono">{formatTime(trimStart)}</span>
                  </div>
                  <Slider
                    value={[trimStart]}
                    onValueChange={handleTrimStartChange}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    className="w-full [&_[role=slider]]:bg-green-500"
                  />
                </div>

                {/* Current position slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={togglePlayPause}
                        className="h-6 w-6 p-0"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                      <Label className="text-xs text-primary">Position</Label>
                    </div>
                    <span className="text-xs font-mono">{formatTime(currentTime)}</span>
                  </div>
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleCurrentTimeChange}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                {/* End point slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-red-600">Ende</Label>
                    <span className="text-xs font-mono">{formatTime(trimEnd)}</span>
                  </div>
                  <Slider
                    value={[trimEnd]}
                    onValueChange={handleTrimEndChange}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    className="w-full [&_[role=slider]]:bg-red-500"
                  />
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Dauer: {formatTime(Math.max(0, trimEnd - trimStart))} von {formatTime(videoDuration)}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Zielgröße</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetDimensions}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Zurücksetzen
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Größe (px)</Label>
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
                    value={dimensions.width || ''}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Höhe</Label>
                  <Input
                    type="number"
                    value={dimensions.height || ''}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label className="text-xs">Seitenverhältnis</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={customAspect || aspectRatioString}
                  onChange={(e) => handleAspectRatioChange(e.target.value)}
                  placeholder="16:9"
                  className="h-8 text-sm w-20"
                />
                <span className="text-xs text-muted-foreground">
                  Original: {getAspectRatioString(originalDimensions.width, originalDimensions.height)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Crop an Ziel-Verhältnis</Label>
                <Button
                  variant={cropAspectLocked ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleCropAspect}
                >
                  {cropAspectLocked ? 'An' : 'Aus'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Wenn „An", wird das Crop-Tool auf das Verhältnis deiner Zielgröße gesperrt.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Original: {originalDimensions.width} × {originalDimensions.height} px
            </p>

            {completedCrop && (
              <p className="text-xs text-muted-foreground">
                Aktueller Ausschnitt: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleResetAll}>
            Alles zurücksetzen
          </Button>
          <Button onClick={handleApply}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};