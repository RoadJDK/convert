import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as SliderPrimitive from '@radix-ui/react-slider';
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


  // Separate aspect ratio inputs
  const [aspectWidth, setAspectWidth] = useState(0);
  const [aspectHeight, setAspectHeight] = useState(0);

  // Computed aspect ratio string for display
  const aspectRatioString = useMemo(() => {
    return getAspectRatioString(dimensions.width, dimensions.height);
  }, [dimensions.width, dimensions.height]);

  // Sync aspect ratio inputs when dimensions change
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      const divisor = gcd(Math.round(dimensions.width), Math.round(dimensions.height));
      setAspectWidth(Math.round(dimensions.width / divisor));
      setAspectHeight(Math.round(dimensions.height / divisor));
    }
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
      setAspectWidth(0);
      setAspectHeight(0);
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

  // Use refs to avoid stale closures in video time update
  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  
  useEffect(() => {
    trimStartRef.current = trimStart;
    trimEndRef.current = trimEnd;
  }, [trimStart, trimEnd]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      const endTime = trimEndRef.current;
      const startTime = trimStartRef.current;
      
      // Only clamp if we're playing and exceed the end
      if (endTime > 0 && t >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = endTime;
        setCurrentTime(endTime);
        return;
      }
      if (t < startTime) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
        return;
      }
      setCurrentTime(t);
    }
  }, []);

  // Separate handlers for Start/End range slider and Position slider
  const handleRangeChange = useCallback(
    (values: number[]) => {
      if (!Array.isArray(values) || values.length !== 2) return;

      const minGap = 0.1;
      let start = values[0];
      let end = values[1];

      // Enforce constraints
      start = Math.max(0, Math.min(start, end - minGap));
      end = Math.min(videoDuration, Math.max(end, start + minGap));

      setTrimStart(start);
      setTrimEnd(end);

      // Only clamp position if it's now out of bounds
      setCurrentTime(prev => {
        if (prev < start) return start;
        if (prev > end) return end;
        return prev;
      });

      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        // Preview the adjusted boundary
        const wasCloserToStart = Math.abs(values[0] - trimStart) > Math.abs(values[1] - trimEnd);
        videoRef.current.currentTime = wasCloserToStart ? start : end;
      }
    },
    [videoDuration, trimStart, trimEnd]
  );

  const handlePositionChange = useCallback(
    (values: number[]) => {
      if (!Array.isArray(values) || values.length !== 1) return;

      let pos = values[0];
      // Clamp position within trim range
      pos = Math.max(trimStart, Math.min(trimEnd, pos));

      setCurrentTime(pos);

      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = pos;
      }
    },
    [trimStart, trimEnd]
  );

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Always start playback within trim range.
        // If we're at (or extremely close to) the end, restart at trimStart to avoid instantly stopping.
        if (
          videoRef.current.currentTime < trimStart ||
          videoRef.current.currentTime >= trimEnd - 0.05
        ) {
          videoRef.current.currentTime = trimStart;
          setCurrentTime(trimStart);
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, trimEnd, trimStart]);

  // Live dimension change (updates while typing) - also updates crop rectangle
  const handleDimensionChange = useCallback((key: 'width' | 'height', value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      // Allow empty or invalid values while typing
      setDimensions(prev => ({ ...prev, [key]: num || 0 }));
      return;
    }

    let newDimensions = { ...dimensions };
    if (aspectLocked && originalDimensions.width > 0 && originalDimensions.height > 0) {
      const ratio = originalDimensions.width / originalDimensions.height;
      if (key === 'width') {
        newDimensions = { width: num, height: Math.round(num / ratio) };
      } else {
        newDimensions = { width: Math.round(num * ratio), height: num };
      }
    } else {
      newDimensions = { ...dimensions, [key]: num };
    }
    setDimensions(newDimensions);

    // Update crop rectangle to match new dimensions/aspect
    if (originalDimensions.width > 0 && originalDimensions.height > 0 && newDimensions.width > 0 && newDimensions.height > 0) {
      const newAspect = newDimensions.width / newDimensions.height;
      const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, newAspect);
      setCrop(c);
    }
  }, [aspectLocked, originalDimensions, dimensions]);

  // Handle aspect ratio width input change
  const handleAspectWidthChange = useCallback((value: string) => {
    const w = parseInt(value, 10);
    if (isNaN(w) || w <= 0) {
      setAspectWidth(parseInt(value, 10) || 0);
      return;
    }
    setAspectWidth(w);
    
    if (aspectLocked && aspectHeight > 0) {
      const newRatio = w / aspectHeight;
      const newWidth = Math.round(dimensions.height * newRatio);
      setDimensions({ width: newWidth, height: dimensions.height });
      
      if (cropAspectLocked && originalDimensions.width > 0) {
        const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, newRatio);
        setCrop(c);
      }
    }
  }, [aspectLocked, aspectHeight, dimensions.height, cropAspectLocked, originalDimensions]);

  // Handle aspect ratio height input change
  const handleAspectHeightChange = useCallback((value: string) => {
    const h = parseInt(value, 10);
    if (isNaN(h) || h <= 0) {
      setAspectHeight(parseInt(value, 10) || 0);
      return;
    }
    setAspectHeight(h);
    
    if (aspectLocked && aspectWidth > 0) {
      const newRatio = aspectWidth / h;
      const newHeight = Math.round(dimensions.width / newRatio);
      setDimensions({ width: dimensions.width, height: newHeight });
      
      if (cropAspectLocked && originalDimensions.width > 0) {
        const c = centerAspectCrop(originalDimensions.width, originalDimensions.height, newRatio);
        setCrop(c);
      }
    }
  }, [aspectLocked, aspectWidth, dimensions.width, cropAspectLocked, originalDimensions]);

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

  // When crop is completed (mouse released), sync dimensions and aspect ratio
  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c);
    
    // Calculate actual pixel dimensions from crop
    let scaleX = 1, scaleY = 1;
    if (file?.type === 'image' && imgRef.current) {
      scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    } else if (file?.type === 'video' && videoRef.current) {
      scaleX = videoRef.current.videoWidth / videoRef.current.clientWidth;
      scaleY = videoRef.current.videoHeight / videoRef.current.clientHeight;
    }
    
    const cropWidth = Math.round(c.width * scaleX);
    const cropHeight = Math.round(c.height * scaleY);
    
    if (cropWidth > 0 && cropHeight > 0) {
      setDimensions({ width: cropWidth, height: cropHeight });
    }
  }, [file?.type]);

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
    setAspectWidth(0);
    setAspectHeight(0);
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
                  onComplete={handleCropComplete}
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
                  onComplete={handleCropComplete}
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

            {/* Video timeline */}
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

                {/* Play button and duration */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlayPause}
                    className="h-7 w-7 p-0"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>

                {/* Unified timeline - two overlapping sliders for better control */}
                <div className="space-y-3">
                  {/* Time labels */}
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span className="text-green-600">{formatTime(trimStart)}</span>
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-red-600">{formatTime(trimEnd)}</span>
                  </div>

                  {/* Stacked sliders - Range on top (z-20), Position below (z-10) */}
                  <div className="relative h-10">
                    {/* Position slider (background layer) */}
                    <SliderPrimitive.Root
                      value={[currentTime]}
                      onValueChange={handlePositionChange}
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      className="absolute inset-0 flex w-full touch-none select-none items-center z-10"
                    >
                      <SliderPrimitive.Track className="relative h-8 w-full grow overflow-hidden rounded-md bg-muted">
                        {/* Highlight the trimmed range */}
                        <div 
                          className="absolute h-full bg-primary/20"
                          style={{
                            left: `${(trimStart / videoDuration) * 100}%`,
                            width: `${((trimEnd - trimStart) / videoDuration) * 100}%`
                          }}
                        />
                      </SliderPrimitive.Track>
                      {/* Position thumb - thin line */}
                      <SliderPrimitive.Thumb
                        className="block h-6 w-1 rounded-full bg-primary shadow-lg ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-ew-resize"
                        aria-label="Position"
                      />
                    </SliderPrimitive.Root>

                    {/* Start/End range slider (foreground layer - clickable edges) */}
                    <SliderPrimitive.Root
                      value={[trimStart, trimEnd]}
                      onValueChange={handleRangeChange}
                      min={0}
                      max={videoDuration}
                      step={0.1}
                      minStepsBetweenThumbs={1}
                      className="absolute inset-0 flex w-full touch-none select-none items-center z-20 pointer-events-none"
                    >
                      <SliderPrimitive.Track className="relative h-8 w-full grow overflow-hidden rounded-md pointer-events-none">
                        <SliderPrimitive.Range className="absolute h-full pointer-events-none" />
                      </SliderPrimitive.Track>
                      {/* Start thumb */}
                      <SliderPrimitive.Thumb
                        className="block h-10 w-4 rounded-sm border-2 border-green-500 bg-green-500 shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-ew-resize pointer-events-auto"
                        aria-label="Start"
                      />
                      {/* End thumb */}
                      <SliderPrimitive.Thumb
                        className="block h-10 w-4 rounded-sm border-2 border-red-500 bg-red-500 shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-ew-resize pointer-events-auto"
                        aria-label="Ende"
                      />
                    </SliderPrimitive.Root>
                  </div>
                  
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Dauer: {formatTime(Math.max(0, trimEnd - trimStart))}
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
              <Label className="text-sm">Größe (px)</Label>
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

            {/* Aspect Ratio - Split into two inputs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Seitenverhältnis</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAspectLocked(!aspectLocked)}
                  className={aspectLocked ? 'text-primary h-6 px-2' : 'text-muted-foreground h-6 px-2'}
                  title={aspectLocked ? 'Verhältnis gelinkt' : 'Verhältnis frei'}
                >
                  {aspectLocked ? <Link2 className="h-3 w-3" /> : <Unlink2 className="h-3 w-3" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={aspectWidth || ''}
                  onChange={(e) => handleAspectWidthChange(e.target.value)}
                  placeholder="16"
                  className="h-8 text-sm w-16 text-center"
                  min={1}
                />
                <span className="text-muted-foreground font-medium">:</span>
                <Input
                  type="number"
                  value={aspectHeight || ''}
                  onChange={(e) => handleAspectHeightChange(e.target.value)}
                  placeholder="9"
                  className="h-8 text-sm w-16 text-center"
                  min={1}
                />
                <span className="text-xs text-muted-foreground ml-2">
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