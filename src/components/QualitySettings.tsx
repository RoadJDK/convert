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
// IMPORTANT: This estimates based on RE-ENCODING, not the original format
// Re-encoding typically produces files close to or LARGER than original when quality is high
function estimateFileSize(originalSize: number, percentage: number, outputFormat: string, fileType: 'image' | 'video'): number {
  // Internal quality: 100% displayed = 50% internal, 200% = 100%
  const internalQuality = percentage / 2;
  
  // IMAGE FORMATS
  if (fileType === 'image') {
    // PNG is lossless - re-encoding keeps similar or larger size
    if (outputFormat === 'png') {
      return Math.round(originalSize * 1.1);
    }
    
    // For same-format or lossy re-encoding (JPEG, WebP)
    // Quality 100% displayed (50% internal) = ~0.5 quality = moderate compression
    // Quality 200% displayed (100% internal, capped at 92%) = ~0.92 quality = minimal compression
    
    // JPEG: At high quality, can be LARGER than original due to re-encoding
    if (outputFormat === 'jpeg') {
      // Map: 50% displayed (25% internal) = 0.3x, 100% (50%) = 0.8x, 200% (92%) = 1.2x
      const qualityFactor = internalQuality / 100; // 0.25 to 0.92
      const ratio = 0.3 + qualityFactor * 1.0; // 0.55 at 100%, 1.2 at max
      return Math.round(originalSize * ratio);
    }
    
    // WebP: Generally more efficient than JPEG but still can grow at high quality
    // Map: 50% displayed = 0.2x, 100% = 0.5x, 200% = 0.9x
    const qualityFactor = internalQuality / 100;
    const ratio = 0.2 + qualityFactor * 0.7;
    return Math.round(originalSize * ratio);
  }
  
  // VIDEO FORMATS
  // Video re-encoding is complex and depends heavily on content
  if (outputFormat === 'mp4') {
    const qualityFactor = internalQuality / 100;
    const ratio = 0.3 + qualityFactor * 0.5;
    return Math.round(originalSize * ratio);
  }
  
  // WebM
  const qualityFactor = internalQuality / 100;
  const ratio = 0.25 + qualityFactor * 0.55;
  return Math.round(originalSize * ratio);
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