import { useId, useState, useMemo } from 'react';
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
  CleanupMask,
} from '@/types/converter';
import { estimateConvertedFileSize } from '@/lib/sizeEstimation';
import { createLocalRemovalPlan } from '@/lib/localRemovalPlan';
import { applyConversionPreset, getConversionPresets } from '@/lib/conversionPresets';
import {
  EraserMaskIcon,
  MaxSizeIcon,
  PercentBadgeIcon,
  SettingsSlidersIcon,
  WatermarkCleanIcon,
} from '@/components/icons/MediaConvertIcons';

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
  removeWatermark?: boolean;
  onRemoveWatermarkChange?: (enabled: boolean) => void;
  cleanupArea?: CropArea;
  cleanupMask?: CleanupMask;
  onCleanupAreaClick?: () => void;
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
  removeWatermark,
  onRemoveWatermarkChange,
  cleanupArea,
  cleanupMask,
  onCleanupAreaClick,
}: QualitySettingsProps) => {
  const [open, setOpen] = useState(false);
  const backgroundRemovalId = useId();
  const watermarkRemovalId = useId();
  const backgroundRemovalDescriptionId = useId();
  const watermarkRemovalDescriptionId = useId();
  const supportsRemovalControls = fileType === 'image' || fileType === 'video';
  const supportsBackgroundRemoval = fileType === 'image';
  const presets = useMemo(() => getConversionPresets(fileType), [fileType]);

  const handleModeChange = (mode: string) => {
    onChange({ ...settings, mode: mode as QualityMode });
  };

  const handlePercentageChange = (value: number[]) => {
    onChange({ ...settings, percentage: value[0] });
  };

  const handleScaleChange = (value: number[]) => {
    onChange({ ...settings, scale: value[0] });
  };

  const handleScaleInputChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 10 && num <= 200) {
      onChange({ ...settings, scale: num });
    }
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
  const removalDimensions = originalDimensions ?? { width: 1024, height: 768 };
  const backgroundRemovalPlan = useMemo(() => createLocalRemovalPlan({
    target: 'background',
    width: removalDimensions.width,
    height: removalDimensions.height,
  }), [removalDimensions.height, removalDimensions.width]);
  const watermarkRemovalPlan = useMemo(() => createLocalRemovalPlan({
    target: 'static-corner-watermark',
    width: removalDimensions.width,
    height: removalDimensions.height,
  }), [removalDimensions.height, removalDimensions.width]);

  // Estimate file size based on quality, format, dimensions, and crop
  const estimatedSize = useMemo(() => {
    if (!originalSize || settings.mode !== 'percentage') return null;
    return estimateConvertedFileSize({
      originalSize,
      originalFormat,
      outputFormat: currentFormat,
      percentage: settings.percentage,
      originalDimensions,
      cropArea,
      scale: settings.scale,
      fileType,
    });
  }, [originalSize, originalFormat, settings.percentage, settings.scale, settings.mode, currentFormat, originalDimensions, cropArea, fileType]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          aria-label="Qualitätseinstellungen"
          title="Qualitätseinstellungen"
          className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
        >
          <SettingsSlidersIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-popover border border-border shadow-lg z-50" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Qualitätseinstellungen</h4>

          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Presets</p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    title={preset.description}
                    onClick={() => onChange(applyConversionPreset(settings, preset))}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {supportsRemovalControls && ((supportsBackgroundRemoval && onRemoveBackgroundChange) || onRemoveWatermarkChange) && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {fileType === 'video'
                  ? "Nur für eigene Videos. Alles läuft lokal; das Original bleibt unverändert."
                  : "Nur für eigene Bilder. Alles läuft lokal; das Original bleibt unverändert."}
              </p>
              {supportsBackgroundRemoval && onRemoveBackgroundChange && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <EraserMaskIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={backgroundRemovalId} className="text-xs font-medium">
                        {backgroundRemovalPlan.uiLabel}
                      </Label>
                    </div>
                    <Switch
                      id={backgroundRemovalId}
                      aria-describedby={backgroundRemovalDescriptionId}
                      checked={removeBackground ?? false}
                      onCheckedChange={onRemoveBackgroundChange}
                    />
                  </div>
                  <p id={backgroundRemovalDescriptionId} className="text-xs leading-relaxed text-muted-foreground">
                    {backgroundRemovalPlan.uiDescription}
                  </p>
                </div>
              )}
              {onRemoveWatermarkChange && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <WatermarkCleanIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={watermarkRemovalId} className="text-xs font-medium">
                        {watermarkRemovalPlan.uiLabel}
                      </Label>
                    </div>
                    <Switch
                      id={watermarkRemovalId}
                      aria-describedby={watermarkRemovalDescriptionId}
                      checked={removeWatermark ?? false}
                      onCheckedChange={onRemoveWatermarkChange}
                    />
                  </div>
                  <p id={watermarkRemovalDescriptionId} className="text-xs leading-relaxed text-muted-foreground">
                    {fileType === 'video'
                      ? "Lokale Frame-Masken-Bereinigung im degradierten Exportpfad, keine vollständige Entfernungsgarantie."
                      : watermarkRemovalPlan.uiDescription}
                  </p>
                  {onCleanupAreaClick && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => {
                        setOpen(false);
                        onCleanupAreaClick();
                      }}
                    >
                      {cleanupArea || cleanupMask ? "Maske ändern" : "Bereich wählen"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          
          <Tabs value={settings.mode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage" className="gap-1.5 text-xs">
                <PercentBadgeIcon className="h-3 w-3" />
                Prozent
              </TabsTrigger>
              <TabsTrigger value="maxSize" className="gap-1.5 text-xs">
                <MaxSizeIcon className="h-3 w-3" />
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
              <div className="flex items-center justify-between gap-3 pt-2">
                <Label className="text-xs">Skalierung</Label>
                <div className="flex items-center gap-1">
                  <Input
                    aria-label="Skalierung"
                    type="number"
                    value={settings.scale}
                    onChange={(event) => handleScaleInputChange(event.target.value)}
                    className="h-8 w-16 text-sm"
                    min={10}
                    max={200}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[settings.scale]}
                onValueChange={handleScaleChange}
                min={10}
                max={200}
                step={5}
                className="w-full"
                data-testid="scale-slider"
              />
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
