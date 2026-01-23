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
import { CropArea, ConvertibleFile } from '@/types/converter';
import { Crop as CropIcon, Maximize2 } from 'lucide-react';

interface CropDialogProps {
  file: ConvertibleFile | null;
  open: boolean;
  onClose: () => void;
  onApply: (cropArea: CropArea | undefined, dimensions?: { width: number; height: number }) => void;
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

export const CropDialog = ({ file, open, onClose, onApply }: CropDialogProps) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [mode, setMode] = useState<'crop' | 'dimensions'>('crop');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [aspectLocked, setAspectLocked] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('');

  useEffect(() => {
    if (file && open) {
      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result as string);
      };
      reader.readAsDataURL(file.file);
    }
  }, [file, open]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setOriginalDimensions({ width: naturalWidth, height: naturalHeight });
    setDimensions({ width: naturalWidth, height: naturalHeight });
    
    const crop = centerAspectCrop(naturalWidth, naturalHeight, naturalWidth / naturalHeight);
    setCrop(crop);
  }, []);

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
    if (mode === 'crop' && completedCrop && imgRef.current) {
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      
      const cropArea: CropArea = {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      };
      onApply(cropArea);
    } else if (mode === 'dimensions') {
      onApply(undefined, dimensions);
    }
    onClose();
  };

  const handleReset = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setDimensions(originalDimensions);
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Bild bearbeiten
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'crop' | 'dimensions')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="crop" className="gap-2">
              <CropIcon className="h-4 w-4" />
              Zuschneiden
            </TabsTrigger>
            <TabsTrigger value="dimensions" className="gap-2">
              <Maximize2 className="h-4 w-4" />
              Größe ändern
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crop" className="mt-4">
            <div className="flex justify-center bg-muted/30 rounded-lg p-4 max-h-[50vh] overflow-auto">
              {imgSrc && (
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
            </div>
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
