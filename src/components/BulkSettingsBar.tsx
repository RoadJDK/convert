import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { X, Sparkles, Loader2, Maximize } from 'lucide-react';
import { QualitySettings, QualityMode } from '@/types/converter';

interface BulkSettingsBarProps {
  selectedCount: number;
  onApply: (settings: Partial<{ qualitySettings: QualitySettings }>) => void;
  onClear: () => void;
  onAIRenameAll?: () => void;
  isAIRenaming?: boolean;
  renameHelperEnabled: boolean;
  onToggleRenameHelper: (enabled: boolean) => void;
}

export const BulkSettingsBar = ({
  selectedCount,
  onApply,
  onClear,
  onAIRenameAll,
  isAIRenaming,
  renameHelperEnabled,
  onToggleRenameHelper,
}: BulkSettingsBarProps) => {
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(100);
  const [maxSizeKB, setMaxSizeKB] = useState(500);
  const [scale, setScale] = useState(100);

  const handleApply = () => {
    onApply({
      qualitySettings: { mode, percentage, maxSizeKB, scale },
    });
  };

  if (selectedCount === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} Datei{selectedCount !== 1 ? 'en' : ''} ausgewählt
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* KI-Umbenennung Toggle */}
      <div className="flex items-center justify-between py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm">KI-Umbenennung</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={renameHelperEnabled}
            onCheckedChange={onToggleRenameHelper}
          />
          {renameHelperEnabled && onAIRenameAll && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onAIRenameAll}
              disabled={isAIRenaming}
              className="gap-2 ml-2"
            >
              {isAIRenaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Umbenennen
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {/* Quality settings */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as QualityMode)} className="flex-1 min-w-[200px]">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="percentage" className="text-xs">Prozent</TabsTrigger>
            <TabsTrigger value="maxSize" className="text-xs">Max Größe</TabsTrigger>
          </TabsList>

          <TabsContent value="percentage" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Qualität</Label>
              <span className="text-sm font-medium">{percentage}%</span>
            </div>
            <Slider
              value={[percentage]}
              onValueChange={(v) => setPercentage(v[0])}
              min={10}
              max={100}
              step={5}
            />
          </TabsContent>

          <TabsContent value="maxSize" className="mt-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Max Größe</Label>
              <Input
                type="number"
                value={maxSizeKB}
                onChange={(e) => setMaxSizeKB(parseInt(e.target.value, 10) || 500)}
                className="h-8 w-20"
                min={10}
              />
              <span className="text-xs text-muted-foreground">KB</span>
            </div>
          </TabsContent>
        </Tabs>

        {/* Scale/Upscaling */}
        <div className="min-w-[150px] space-y-2">
          <div className="flex items-center gap-2">
            <Maximize className="h-3 w-3 text-muted-foreground" />
            <Label className="text-xs">Skalierung</Label>
            <span className="text-xs font-medium ml-auto">{scale}%</span>
          </div>
          <Slider
            value={[scale]}
            onValueChange={(v) => setScale(v[0])}
            min={10}
            max={200}
            step={10}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleApply}>
            Anwenden
          </Button>
        </div>
      </div>
    </div>
  );
};