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

// Estimate file size based on quality percentage
// WebP/JPEG compression is highly variable, this is a rough estimate
function estimateFileSize(originalSize: number, percentage: number, outputFormat: string): number {
  // Internal quality: 50% displayed = 25% internal, 100% = 50%, 200% = 100%
  const internalQuality = percentage / 2;
  
  // Base compression ratios for different formats (empirical estimates)
  // These are rough and depend heavily on image content
  if (outputFormat === 'png') {
    // PNG is lossless, size stays similar or slightly smaller
    return Math.round(originalSize * 0.9);
  }
  
  // WebP and JPEG compression estimates
  // At 50% internal quality (~100% displayed), expect roughly 15-25% of original
  // At 25% internal quality (~50% displayed), expect roughly 5-15% of original
  // At 92% internal quality (~184% displayed), expect roughly 30-50% of original
  const minRatio = 0.05; // Minimum compression (very low quality)
  const maxRatio = 0.50; // Maximum size at high quality
  
  // Map internal quality (25-100) to compression ratio
  const qualityNormalized = (internalQuality - 25) / 75; // 0 to 1
  const compressionRatio = minRatio + (maxRatio - minRatio) * Math.pow(qualityNormalized, 1.5);
  
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

  // Estimate file size based on quality
  const estimatedSize = useMemo(() => {
    if (!originalSize || settings.mode !== 'percentage') return null;
    return estimateFileSize(originalSize, settings.percentage, currentFormat);
  }, [originalSize, settings.percentage, settings.mode, currentFormat]);

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