import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileType, QualitySettings, QualityMode } from '@/types/converter';
import {
  BatchFilesIcon,
  LoaderRingIcon,
  MaxSizeIcon,
  PercentBadgeIcon,
  RenameSparkIcon,
} from '@/components/icons/MediaConvertIcons';

interface BulkSettingsSidebarProps {
  open: boolean;
  selectedCount: number;
  selectedType?: FileType | null;
  onApply: (settings: Partial<{ qualitySettings: QualitySettings }>) => void;
  onClose: () => void;
  onAIRenameAll?: () => void;
  isAIRenaming?: boolean;
  onCompressPdfs?: () => void;
  onMergePdfs?: () => void;
  onReorderPdf?: (pageOrder: string) => void;
  onRotatePdfs?: (degrees: 90 | 180 | 270) => void;
  onSplitPdfs?: () => void;
}

export const BulkSettingsSidebar = ({
  open,
  selectedCount,
  selectedType,
  onApply,
  onClose,
  onAIRenameAll,
  isAIRenaming,
  onCompressPdfs,
  onMergePdfs,
  onReorderPdf,
  onRotatePdfs,
  onSplitPdfs,
}: BulkSettingsSidebarProps) => {
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(100);
  const [maxSizeKB, setMaxSizeKB] = useState(500);
  const [pageOrder, setPageOrder] = useState('');

  // Reset when sidebar opens
  useEffect(() => {
    if (open) {
      setMode('percentage');
      setPercentage(100);
      setMaxSizeKB(500);
      setPageOrder('');
    }
  }, [open]);

  const handleApply = () => {
    onApply({
      qualitySettings: { mode, percentage, maxSizeKB, scale: 100 },
    });
    onClose();
  };

  if (!open) {
    return null;
  }

  const isPdfSelection = selectedType === 'pdf';

  return (
    <aside
      role="region"
      aria-labelledby="bulk-settings-title"
      className="glass-panel fixed inset-x-4 bottom-4 z-[60] max-h-[calc(100vh-2rem)] overflow-auto rounded-xl p-5 shadow-2xl sm:inset-x-auto sm:right-4 sm:top-1/2 sm:w-[340px] sm:-translate-y-1/2"
    >
      <div className="border-b border-white/10 pb-4">
        <h2 id="bulk-settings-title" className="text-lg font-semibold text-foreground">
          {selectedCount} Datei{selectedCount !== 1 ? 'en' : ''} ausgewählt
        </h2>
      </div>

      <div className="space-y-6 py-6">
        {/* KI-Umbenennung */}
        {onAIRenameAll && !isPdfSelection && (
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-center gap-2">
              <RenameSparkIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">KI-Umbenennung</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onAIRenameAll}
              disabled={isAIRenaming}
              className="h-8 w-8"
              title="KI-Umbenennung"
            >
              {isAIRenaming ? (
                <LoaderRingIcon className="h-4 w-4 animate-spin" />
              ) : (
                <RenameSparkIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {isPdfSelection && (
          <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.055] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <BatchFilesIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">PDF-Werkzeuge</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Zusammenführen läuft lokal im Browser. Originale bleiben unverändert; private Inhalte werden nicht hochgeladen.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full gap-2"
              onClick={onMergePdfs}
              disabled={selectedCount < 2 || !onMergePdfs}
            >
              <BatchFilesIcon className="h-4 w-4" />
              PDFs zusammenführen
            </Button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onSplitPdfs}
                disabled={!onSplitPdfs}
              >
                <BatchFilesIcon className="h-4 w-4" />
                Seiten aufteilen
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onRotatePdfs?.(90)}
                disabled={!onRotatePdfs}
              >
                90° drehen
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 sm:col-span-2"
                onClick={onCompressPdfs}
                disabled={!onCompressPdfs}
              >
                PDFs komprimieren
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf-page-order">Seitenfolge</Label>
              <div className="grid gap-2">
                <Input
                  id="pdf-page-order"
                  value={pageOrder}
                  onChange={(event) => setPageOrder(event.target.value)}
                  placeholder="z.B. 3,1,2"
                  disabled={selectedCount !== 1 || !onReorderPdf}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onReorderPdf?.(pageOrder)}
                  disabled={selectedCount !== 1 || !pageOrder.trim() || !onReorderPdf}
                >
                  Seiten neu sortieren
                </Button>
              </div>
              {selectedCount !== 1 && (
                <p className="text-xs text-muted-foreground">
                  Neu sortieren ist pro einzelner PDF-Datei verfügbar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Quality settings */}
        {!isPdfSelection && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Qualitätseinstellungen</h3>

          <Tabs value={mode} onValueChange={(v) => setMode(v as QualityMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage" className="gap-2">
                <PercentBadgeIcon className="h-4 w-4" />
                Prozent
              </TabsTrigger>
              <TabsTrigger value="maxSize" className="gap-2">
                <MaxSizeIcon className="h-4 w-4" />
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
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          {!isPdfSelection && (
            <Button onClick={handleApply} className="flex-1">
              Anwenden
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};
