import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles, Loader2, Percent, HardDrive } from 'lucide-react';
import { QualitySettings, QualityMode } from '@/types/converter';

interface BulkSettingsSidebarProps {
  open: boolean;
  selectedCount: number;
  onApply: (settings: Partial<{ qualitySettings: QualitySettings }>) => void;
  onClose: () => void;
  onAIRenameAll?: () => void;
  isAIRenaming?: boolean;
}

export const BulkSettingsSidebar = ({
  open,
  selectedCount,
  onApply,
  onClose,
  onAIRenameAll,
  isAIRenaming,
}: BulkSettingsSidebarProps) => {
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(100);
  const [maxSizeKB, setMaxSizeKB] = useState(500);

  // Reset when sidebar opens
  useEffect(() => {
    if (open) {
      setMode('percentage');
      setPercentage(100);
      setMaxSizeKB(500);
    }
  }, [open]);

  const handleApply = () => {
    onApply({
      qualitySettings: { mode, percentage, maxSizeKB, scale: 100 },
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={false}>
      <SheetContent 
        side="right" 
        className="w-[340px] !h-auto !max-h-[60vh] !top-1/2 !-translate-y-1/2 !right-4 !left-auto !translate-x-0 !rounded-xl shadow-2xl border !inset-auto fixed"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>
            {selectedCount} Datei{selectedCount !== 1 ? 'en' : ''} ausgewählt
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* KI-Umbenennung */}
          {onAIRenameAll && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">KI-Umbenennung</span>
              </div>
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
                Umbenennen
              </Button>
            </div>
          )}

          {/* Quality settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Qualitätseinstellungen</h3>
            
            <Tabs value={mode} onValueChange={(v) => setMode(v as QualityMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="percentage" className="gap-2">
                  <Percent className="h-4 w-4" />
                  Prozent
                </TabsTrigger>
                <TabsTrigger value="maxSize" className="gap-2">
                  <HardDrive className="h-4 w-4" />
                  Max Größe
                </TabsTrigger>
              </TabsList>

              <TabsContent value="percentage" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Qualität</Label>
                  <span className="text-lg font-semibold">{percentage}%</span>
                </div>
                <Slider
                  value={[percentage]}
                  onValueChange={(v) => setPercentage(v[0])}
                  min={50}
                  max={200}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  100% = Standard • 200% = Maximum
                </p>
              </TabsContent>

              <TabsContent value="maxSize" className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap">Max Größe</Label>
                  <Input
                    type="number"
                    value={maxSizeKB}
                    onChange={(e) => setMaxSizeKB(parseInt(e.target.value, 10) || 500)}
                    className="w-24"
                    min={10}
                  />
                  <span className="text-sm text-muted-foreground">KB</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Qualität wird automatisch angepasst um die Zielgröße zu erreichen
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 mt-4 border-t">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Abbrechen
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Anwenden
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
