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

/**
 * Compression ratio multipliers for format conversion.
 * These are multipliers applied to source file size (not pixel-based).
 *
 * Based on empirical testing:
 * - A 95KB JPEG → WebP 50% = ~23KB (0.24x)
 * - A 95KB JPEG → WebP 100% = ~45KB (0.47x)
 * - A 95KB JPEG → JPEG 50% = ~69KB (0.73x)
 * - A 95KB JPEG → JPEG 100% = ~153KB (1.6x, higher quality than source)
 * - A 95KB JPEG → PNG 100% = ~971KB (10.2x, lossless)
 */
const FORMAT_COMPRESSION_MULTIPLIERS: Record<string, {
  // Base multiplier at 100% quality (compared to typical JPEG source)
  baseMultiplier: number;
  // How quality affects size: lowQualityMultiplier at 50%, baseMultiplier at 100%
  lowQualityMultiplier: number;
  // Multiplier at 200% quality (max quality / upscaling)
  highQualityMultiplier: number;
  // Is this format lossless? (quality slider becomes scale slider)
  isLossless: boolean;
}> = {
  webp: {
    baseMultiplier: 0.5,        // WebP 100% ≈ 50% of JPEG size
    lowQualityMultiplier: 0.25, // WebP 50% ≈ 25% of JPEG size
    highQualityMultiplier: 1.0, // WebP 200% ≈ max quality, ~100% of source
    isLossless: false,
  },
  jpeg: {
    baseMultiplier: 1.6,        // JPEG 100% ≈ 160% (higher quality than typical source)
    lowQualityMultiplier: 0.75, // JPEG 50% ≈ 75% of source
    highQualityMultiplier: 2.5, // JPEG 200% ≈ 250% (near-lossless quality)
    isLossless: false,
  },
  png: {
    baseMultiplier: 10.0,       // PNG 100% ≈ 10x source (lossless, full size)
    lowQualityMultiplier: 2.5,  // PNG 50% = 0.5x scale = 25% pixels ≈ 2.5x source
    highQualityMultiplier: 40,  // PNG 200% = 2x scale = 400% pixels ≈ 40x source
    isLossless: true,
  },
  avif: {
    baseMultiplier: 0.35,       // AVIF 100% ≈ 35% of JPEG (best compression)
    lowQualityMultiplier: 0.15, // AVIF 50% ≈ 15% of source
    highQualityMultiplier: 1.5, // AVIF 200% includes 2x scale
    isLossless: false,
  },
  gif: {
    baseMultiplier: 4.0,        // GIF ≈ 4x source (256 colors, no quality control)
    lowQualityMultiplier: 4.0,
    highQualityMultiplier: 16,  // GIF 200% = 2x scale = 4x pixels
    isLossless: true,
  },
  bmp: {
    baseMultiplier: 30,         // BMP uncompressed ≈ 30x source
    lowQualityMultiplier: 7.5,  // BMP 50% = 0.5x scale = 25% pixels
    highQualityMultiplier: 120, // BMP 200% = 2x scale = 400% pixels
    isLossless: true,
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

/**
 * File size estimation based on source file size and quality/format conversion.
 *
 * Key insight: For lossy formats, estimating based on source size is more accurate
 * than pixel-based estimation, because the source already captures the image complexity.
 *
 * For lossless/scaling formats (PNG, BMP, GIF), we consider both:
 * - Pixel ratio from cropping/scaling
 * - Format-specific compression characteristics
 */
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
    const qualityFactor = percentage / 100; // 0.5-2.0
    const formatMultiplier = outputFormat === 'webm' ? 0.7 : 0.85;
    // Videos compress well at lower quality, scale roughly with quality
    return Math.round(originalSize * formatMultiplier * (0.3 + qualityFactor * 0.35));
  }

  // Get format info
  const formatKey = outputFormat.toLowerCase();
  const formatInfo = FORMAT_COMPRESSION_MULTIPLIERS[formatKey] || FORMAT_COMPRESSION_MULTIPLIERS.webp;

  // Calculate pixel ratio from crop and scale
  let pixelRatio = 1.0;
  if (originalDimensions) {
    const originalPixels = originalDimensions.width * originalDimensions.height;
    const croppedWidth = cropArea?.width ?? originalDimensions.width;
    const croppedHeight = cropArea?.height ?? originalDimensions.height;
    const scaleFactor = scale / 100;
    const outputPixels = (croppedWidth * scaleFactor) * (croppedHeight * scaleFactor);
    pixelRatio = outputPixels / originalPixels;
  } else {
    // Fallback: use scale directly
    pixelRatio = (scale / 100) ** 2;
  }

  // Calculate quality-based multiplier
  let qualityMultiplier: number;

  if (percentage <= 100) {
    // 50% → lowQualityMultiplier, 100% → baseMultiplier
    const t = (percentage - 50) / 50; // 0 at 50%, 1 at 100%
    qualityMultiplier = formatInfo.lowQualityMultiplier +
      t * (formatInfo.baseMultiplier - formatInfo.lowQualityMultiplier);
  } else {
    // 100% → baseMultiplier, 200% → highQualityMultiplier
    const t = (percentage - 100) / 100; // 0 at 100%, 1 at 200%
    qualityMultiplier = formatInfo.baseMultiplier +
      t * (formatInfo.highQualityMultiplier - formatInfo.baseMultiplier);
  }

  // For lossless formats, size is primarily determined by pixel count
  // For lossy formats, quality has more impact than pixel count
  let estimatedSize: number;
  if (formatInfo.isLossless) {
    // Lossless: size scales with pixels, multiplier is for format overhead
    estimatedSize = originalSize * qualityMultiplier;
  } else {
    // Lossy: combine quality and pixel effects
    // Pixel ratio has less impact because lossy formats are adaptive
    estimatedSize = originalSize * qualityMultiplier * Math.sqrt(pixelRatio);
  }

  // Adjust based on source format
  // Converting from PNG/BMP (uncompressed) to lossy → much smaller
  // Converting from JPEG to PNG → much larger
  const sourceFormat = originalFormat?.toLowerCase() || '';
  const sourceIsLossless = sourceFormat.includes('png') ||
    sourceFormat.includes('bmp') ||
    sourceFormat.includes('tiff') ||
    sourceFormat.includes('gif');

  if (sourceIsLossless && !formatInfo.isLossless) {
    // PNG → WebP/JPEG: Source size is inflated, output will be much smaller
    estimatedSize *= 0.15;
  } else if (!sourceIsLossless && formatInfo.isLossless) {
    // JPEG → PNG: Size will increase significantly
    // Already accounted for in multipliers
  }

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
              {estimatedSize && originalSize && (
                <p className="text-xs text-primary font-medium">
                  Geschätzte Größe: ~{formatFileSize(estimatedSize)} ({Math.round((estimatedSize / originalSize) * 100)}% der Originalgröße)
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