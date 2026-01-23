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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { CropArea, ConvertibleFile, TrimRange } from '@/types/converter';
import { Crop as CropIcon, Maximize2, Scissors, Play, Pause } from 'lucide-react';

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
  const [mode, setMode] = useState<'crop' | 'dimensions' | 'trim'>('crop');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [aspectLocked, setAspectLocked] = useState(true);
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
      setMode('crop');
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
      
      const crop = centerAspectCrop(videoWidth, videoHeight, videoWidth / videoHeight);
      setCrop(crop);
    }
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleTimelineChange = useCallback((value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  }, []);

  const handleTrimStartChange = useCallback((value: number[]) => {
    const newStart = Math.min(value[0], trimEnd - 0.5);
    setTrimStart(newStart);
    if (videoRef.current && currentTime < newStart) {
      videoRef.current.currentTime = newStart;
      setCurrentTime(newStart);
    }
  }, [trimEnd, currentTime]);

  const handleTrimEndChange = useCallback((value: number[]) => {
    const newEnd = Math.max(value[0], trimStart + 0.5);
    setTrimEnd(newEnd);
    if (videoRef.current && currentTime > newEnd) {
      videoRef.current.currentTime = newEnd;
      setCurrentTime(newEnd);
    }
  }, [trimStart, currentTime]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

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

  const handleApply = () => {
    let cropArea: CropArea | undefined;
    let trimRange: TrimRange | undefined;

    // Get crop area from either image or video
    if (mode === 'crop' && completedCrop) {
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

    if (mode === 'dimensions') {
      onApply(undefined, dimensions, trimRange);
    } else {
      onApply(cropArea, undefined, trimRange);
    }
    onClose();
  };

  const handleReset = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setDimensions(originalDimensions);
    setTrimStart(0);
    setTrimEnd(videoDuration);
  };

  if (!file) return null;

  const isVideo = file.type === 'video';
  const availableModes = isVideo ? ['crop', 'dimensions', 'trim'] : ['crop', 'dimensions'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            {isVideo ? 'Video bearbeiten' : 'Bild bearbeiten'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'crop' | 'dimensions' | 'trim')}>
          <TabsList className={`grid w-full ${isVideo ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="crop" className="gap-2">
              <CropIcon className="h-4 w-4" />
              Zuschneiden
            </TabsTrigger>
            <TabsTrigger value="dimensions" className="gap-2">
              <Maximize2 className="h-4 w-4" />
              Größe ändern
            </TabsTrigger>
            {isVideo && (
              <TabsTrigger value="trim" className="gap-2">
                <Scissors className="h-4 w-4" />
                Schneiden
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="crop" className="mt-4">
            <div className="flex justify-center bg-muted/30 rounded-lg p-4 max-h-[50vh] overflow-auto">
              {imgSrc && !isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-[45vh]"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    className="max-h-[45vh] object-contain"
                  />
                </ReactCrop>
              )}
              {videoSrc && isVideo && (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-[45vh]"
                >
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={onVideoLoad}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="max-h-[45vh] object-contain"
                    muted
                  />
                </ReactCrop>
              )}
            </div>
            
            {/* Video timeline for crop mode */}
            {isVideo && videoDuration > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlayPause}
                    className="h-8 w-8 p-0"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleTimelineChange}
                    min={0}
                    max={videoDuration}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>
              </div>
            )}
            
            {completedCrop && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Ausschnitt: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
              </p>
            )}
          </TabsContent>

          <TabsContent value="dimensions" className="mt-4 space-y-4">
            <div className="flex items-center gap-4 justify-center">
              <div className="space-y-2">
                <Label className="text-xs">Breite (px)</Label>
                <Input
                  type="number"
                  value={dimensions.width}
                  onChange={(e) => handleDimensionChange('width', e.target.value)}
                  className="w-28"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAspectLocked(!aspectLocked)}
                className={aspectLocked ? 'text-primary' : 'text-muted-foreground'}
              >
                {aspectLocked ? '🔗' : '🔓'}
              </Button>
              <div className="space-y-2">
                <Label className="text-xs">Höhe (px)</Label>
                <Input
                  type="number"
                  value={dimensions.height}
                  onChange={(e) => handleDimensionChange('height', e.target.value)}
                  className="w-28"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Original: {originalDimensions.width} × {originalDimensions.height} px
            </p>
          </TabsContent>

          {isVideo && (
            <TabsContent value="trim" className="mt-4 space-y-4">
              <div className="flex justify-center bg-muted/30 rounded-lg p-4">
                {videoSrc && (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={onVideoLoad}
                    onTimeUpdate={handleVideoTimeUpdate}
                    className="max-h-[40vh] object-contain rounded"
                    muted
                  />
                )}
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlayPause}
                  className="h-8 w-8 p-0"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Slider
                  value={[currentTime]}
                  onValueChange={handleTimelineChange}
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {formatTime(currentTime)}
                </span>
              </div>

              {/* Trim range controls */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Startpunkt</Label>
                  <span className="text-sm font-medium">{formatTime(trimStart)}</span>
                </div>
                <Slider
                  value={[trimStart]}
                  onValueChange={handleTrimStartChange}
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  className="w-full"
                />

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Endpunkt</Label>
                  <span className="text-sm font-medium">{formatTime(trimEnd)}</span>
                </div>
                <Slider
                  value={[trimEnd]}
                  onValueChange={handleTrimEndChange}
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  className="w-full"
                />

                <p className="text-xs text-muted-foreground text-center">
                  Dauer: {formatTime(trimEnd - trimStart)} von {formatTime(videoDuration)}
                </p>
              </div>
            </TabsContent>
          )}
        </Tabs>

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
