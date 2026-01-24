import { useState, useMemo } from 'react';
import { Settings2, Percent, HardDrive, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  QualitySettings as QualitySettingsType, 
  QualityMode, 
  formatFileSize,
  FileType,
  CropArea,
  displayedToInternalQuality,
} from '@/types/converter';

interface QualitySettingsProps {
  settings: QualitySettingsType;
  onChange: (settings: QualitySettingsType) => void;
  disabled?: boolean;
  originalSize?: number;
  originalFormat?: string; // e.g., 'image/png', 'image/jpeg'
  originalDimensions?: { width: number; height: number };
  cropArea?: CropArea;
  fileType?: FileType;
  removeBackground?: boolean;
  onRemoveBackgroundChange?: (enabled: boolean) => void;
}

// Bytes per pixel estimates for different formats at different quality levels
// Based on empirical testing with typical photographic content
const FORMAT_COMPRESSION_RATIOS: Record<string, { 
  lossless: number;  // bytes per pixel at max quality
  lossy: (quality: number) => number;  // function of internal quality (0-1)
}> = {
  // WebP: Excellent compression
  webp: {
    lossless: 2.5,
    lossy: (q) => 0.15 + q * 0.85, // 0.15-1.0 bpp
  },
  // JPEG: Good compression, no alpha
  jpeg: {
    lossless: 1.5, // JPEG is always lossy, this is "max quality"
    lossy: (q) => 0.1 + q * 0.9, // 0.1-1.0 bpp
  },
  // PNG: Lossless, larger files
  png: {
    lossless: 3.0,
    lossy: (q) => 3.0, // PNG doesn't have quality settings
  },
  // AVIF: Best compression
  avif: {
    lossless: 2.0,
    lossy: (q) => 0.08 + q * 0.6, // 0.08-0.68 bpp
  },
  // GIF: Limited colors, larger
  gif: {
    lossless: 1.5,
    lossy: (q) => 1.5, // GIF is palette-based
  },
  // BMP: Uncompressed
  bmp: {
    lossless: 3.0,
    lossy: (q) => 3.0,
  },
};

// Estimate output dimensions considering crop and scale
function getOutputDimensions(
  originalDimensions: { width: number; height: number } | undefined,
  cropArea: CropArea | undefined,
  scale: number
): { width: number; height: number } {
  if (!originalDimensions) {
    return { width: 1920, height: 1080 }; // fallback estimate
  }
  
  let width = cropArea?.width ?? originalDimensions.width;
  let height = cropArea?.height ?? originalDimensions.height;
  
  // Apply scale
  const scaleFactor = scale / 100;
  width = Math.round(width * scaleFactor);
  height = Math.round(height * scaleFactor);
  
  return { width, height };
}

// Accurate file size estimation based on format conversion
function estimateFileSize(
  originalSize: number,
  originalFormat: string | undefined,
  outputFormat: string,
  percentage: number,
  originalDimensions: { width: number; height: number } | undefined,
  cropArea: CropArea | undefined,
  scale: number,
  fileType: 'image' | 'video'
): number {
  // For videos, use simpler estimation
  if (fileType === 'video') {
    const internalQuality = percentage / 200; // 0.25-1.0
    const baseRatio = outputFormat === 'webm' ? 0.6 : 0.7;
    return Math.round(originalSize * baseRatio * (0.3 + internalQuality * 0.7));
  }
  
  // Get output dimensions
  const outputDims = getOutputDimensions(originalDimensions, cropArea, scale);
  const pixelCount = outputDims.width * outputDims.height;
  
  // Get format compression info
  const formatKey = outputFormat.toLowerCase();
  const formatInfo = FORMAT_COMPRESSION_RATIOS[formatKey] || FORMAT_COMPRESSION_RATIOS.webp;
  
  // Calculate internal quality (0.4-0.92 range)
  const internalQuality = displayedToInternalQuality(percentage);
  
  // Calculate bytes per pixel based on quality
  let bytesPerPixel: number;
  if (formatKey === 'png' || formatKey === 'bmp' || formatKey === 'gif') {
    // Lossless/fixed formats
    bytesPerPixel = formatInfo.lossless;
  } else {
    // Lossy formats
    bytesPerPixel = formatInfo.lossy(internalQuality);
  }
  
  // Estimate base size from pixel count
  let estimatedSize = pixelCount * bytesPerPixel;
  
  // Adjust based on source format (complexity estimation)
  // If source is already compressed (JPEG), content is likely photo-like
  // If source is PNG, content might be graphics with flat colors (compresses better)
  const sourceFormat = originalFormat?.toLowerCase() || '';
  if (sourceFormat.includes('png') || sourceFormat.includes('gif')) {
    // PNG/GIF often has flat colors, compresses better
    estimatedSize *= 0.7;
  } else if (sourceFormat.includes('bmp') || sourceFormat.includes('tiff')) {
    // Uncompressed sources might have more noise
    estimatedSize *= 0.9;
  }
  // JPEG sources are already compressed, estimation should be close
  
  // Apply minimum size (headers, metadata)
  const minSize = 1024; // 1KB minimum
  
  return Math.max(minSize, Math.round(estimatedSize));
}

export const QualitySettings = ({ 
  settings, 
  onChange, 
  disabled, 
  originalSize,
  originalFormat,
  originalDimensions,
  cropArea,
  fileType = 'image',
  removeBackground,
  onRemoveBackgroundChange,
}: QualitySettingsProps) => {
  const [open, setOpen] = useState(false);

  const handleModeChange = (mode: string) => {
    onChange({ ...settings, mode: mode as QualityMode });
  };

  const handlePercentageChange = (value: number[]) => {
    onChange({ ...settings, percentage: value[0] });
  };

  const handleMaxSizeChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      onChange({ ...settings, maxSizeKB: num });
    }
  };

  // Display percentage (100% = internal 50%, 200% = internal 100%)
  const displayPercentage = settings.percentage;

  // Get format options based on file type
  const defaultFormat = fileType === 'image' ? 'webp' : 'webm';
  const currentFormat = settings.outputFormat || defaultFormat;

  // Estimate file size based on quality, format, dimensions, and crop
  const estimatedSize = useMemo(() => {
    if (!originalSize || settings.mode !== 'percentage') return null;
    return estimateFileSize(
      originalSize,
      originalFormat,
      currentFormat,
      settings.percentage,
      originalDimensions,
      cropArea,
      settings.scale,
      fileType
    );
  }, [originalSize, originalFormat, settings.percentage, settings.scale, settings.mode, currentFormat, originalDimensions, cropArea, fileType]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border border-border shadow-lg z-50" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Qualitätseinstellungen</h4>

          {/* Background Removal Toggle (images only) */}
          {fileType === 'image' && onRemoveBackgroundChange && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-secondary/30">
              <div className="flex items-center gap-2">
                <Eraser className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium">Hintergrund entfernen</Label>
              </div>
              <Switch
                checked={removeBackground ?? false}
                onCheckedChange={onRemoveBackgroundChange}
              />
            </div>
          )}
          
          <Tabs value={settings.mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage" className="gap-1.5 text-xs">
                <Percent className="h-3 w-3" />
                Prozent
              </TabsTrigger>
              <TabsTrigger value="maxSize" className="gap-1.5 text-xs">
                <HardDrive className="h-3 w-3" />
                Max Größe
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="percentage" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Qualität</Label>
                <span className="text-sm font-medium">{displayPercentage}%</span>
              </div>
              <Slider
                value={[settings.percentage]}
                onValueChange={handlePercentageChange}
                min={50}
                max={200}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                100% = Standard • 200% = Maximum
              </p>
              {estimatedSize && (
                <p className="text-xs text-primary font-medium">
                  Geschätzte Größe: ~{formatFileSize(estimatedSize)}
                </p>
              )}
            </TabsContent>
            
            <TabsContent value="maxSize" className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Max Größe</Label>
                <Input
                  type="number"
                  value={settings.maxSizeKB}
                  onChange={(e) => handleMaxSizeChange(e.target.value)}
                  className="h-8 text-sm"
                  min={10}
                />
                <span className="text-xs text-muted-foreground">KB</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Qualität wird automatisch angepasst um die Zielgröße zu erreichen
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
};