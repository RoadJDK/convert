import { useState, useMemo } from 'react';
import { Settings2, Percent, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  QualitySettings as QualitySettingsType, 
  QualityMode, 
  formatFileSize,
  IMAGE_OUTPUT_FORMATS,
  VIDEO_OUTPUT_FORMATS,
  FileType,
  OutputFormat,
} from '@/types/converter';

interface QualitySettingsProps {
  settings: QualitySettingsType;
  onChange: (settings: QualitySettingsType) => void;
  disabled?: boolean;
  originalSize?: number; // Original file size in bytes for estimation
  fileType?: FileType; // To show correct format options
}

// Estimate file size based on quality percentage and output format
// Different formats have very different compression characteristics
function estimateFileSize(originalSize: number, percentage: number, outputFormat: string, fileType: 'image' | 'video'): number {
  // Internal quality: 50% displayed = 25% internal, 100% = 50%, 200% = 100%
  const internalQuality = percentage / 2;
  
  // IMAGE FORMATS
  if (fileType === 'image') {
    // PNG is lossless - size stays similar or can be larger than original JPEG
    if (outputFormat === 'png') {
      // PNG typically 2-5x larger than compressed JPEG
      return Math.round(originalSize * 1.5);
    }
    
    // JPEG compression estimates - typically larger than WebP
    if (outputFormat === 'jpeg') {
      const minRatio = 0.10; // Very low quality
      const maxRatio = 0.70; // High quality JPEG
      const qualityNormalized = Math.max(0, (internalQuality - 25) / 75);
      const compressionRatio = minRatio + (maxRatio - minRatio) * Math.pow(qualityNormalized, 1.3);
      return Math.round(originalSize * compressionRatio);
    }
    
    // WebP compression estimates - most efficient
    const minRatio = 0.05; // Very low quality
    const maxRatio = 0.40; // High quality WebP
    const qualityNormalized = Math.max(0, (internalQuality - 25) / 75);
    const compressionRatio = minRatio + (maxRatio - minRatio) * Math.pow(qualityNormalized, 1.5);
    return Math.round(originalSize * compressionRatio);
  }
  
  // VIDEO FORMATS
  // MP4 (H.264) is typically more efficient than WebM (VP9) for most content
  if (outputFormat === 'mp4') {
    const minRatio = 0.15;
    const maxRatio = 0.60;
    const qualityNormalized = Math.max(0, (internalQuality - 25) / 75);
    const compressionRatio = minRatio + (maxRatio - minRatio) * Math.pow(qualityNormalized, 1.2);
    return Math.round(originalSize * compressionRatio);
  }
  
  // WebM (VP9) - good compression but can be larger than MP4
  const minRatio = 0.10;
  const maxRatio = 0.50;
  const qualityNormalized = Math.max(0, (internalQuality - 25) / 75);
  const compressionRatio = minRatio + (maxRatio - minRatio) * Math.pow(qualityNormalized, 1.4);
  return Math.round(originalSize * compressionRatio);
}

export const QualitySettings = ({ settings, onChange, disabled, originalSize, fileType = 'image' }: QualitySettingsProps) => {
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

  const handleFormatChange = (format: string) => {
    onChange({ ...settings, outputFormat: format as OutputFormat });
  };

  // Display percentage (100% = internal 50%, 200% = internal 100%)
  const displayPercentage = settings.percentage;

  // Get format options based on file type
  const formatOptions = fileType === 'image' ? IMAGE_OUTPUT_FORMATS : VIDEO_OUTPUT_FORMATS;
  const defaultFormat = fileType === 'image' ? 'webp' : 'webm';
  const currentFormat = settings.outputFormat || defaultFormat;

  // Estimate file size based on quality and format
  const estimatedSize = useMemo(() => {
    if (!originalSize || settings.mode !== 'percentage') return null;
    return estimateFileSize(originalSize, settings.percentage, currentFormat, fileType);
  }, [originalSize, settings.percentage, settings.mode, currentFormat, fileType]);

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

          {/* Output Format Dropdown */}
          <div className="space-y-2">
            <Label className="text-xs">Zielformat</Label>
            <Select value={currentFormat} onValueChange={handleFormatChange}>
              <SelectTrigger className="w-full h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {formatOptions.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
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