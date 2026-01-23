import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Sparkles, Crop, Loader2 } from 'lucide-react';
import { QualitySettings, QualityMode } from '@/types/converter';

interface BulkSettingsBarProps {
  selectedCount: number;
  onApply: (settings: Partial<{ qualitySettings: QualitySettings }>) => void;
  onClear: () => void;
  onAIRenameAll?: () => void;
  isAIRenaming?: boolean;
  renameHelperEnabled: boolean;
}

export const BulkSettingsBar = ({
  selectedCount,
  onApply,
  onClear,
  onAIRenameAll,
  isAIRenaming,
  renameHelperEnabled,
}: BulkSettingsBarProps) => {
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(85);
  const [maxSizeKB, setMaxSizeKB] = useState(500);

  const handleApply = () => {
    onApply({
      qualitySettings: { mode, percentage, maxSizeKB },
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          {renameHelperEnabled && onAIRenameAll && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onAIRenameAll}
              disabled={isAIRenaming}
              className="gap-2"
            >
              {isAIRenaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              KI-Namen
            </Button>
          )}
          <Button size="sm" onClick={handleApply}>
            Anwenden
          </Button>
        </div>
      </div>
    </div>
  );
};