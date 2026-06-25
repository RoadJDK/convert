import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileType, QualitySettings, QualityMode } from '@/types/converter';
import { applyConversionPreset, getConversionPresets } from '@/lib/conversionPresets';
import {
  BatchFilesIcon,
  LoaderRingIcon,
  MaxSizeIcon,
  PercentBadgeIcon,
  RenameSparkIcon,
} from '@/components/icons/MediaConvertIcons';

interface SelectionPanelProps {
  open: boolean;
  selectedCount: number;
  selectedType?: FileType | null;
  onApply: (settings: Partial<{ qualitySettings: QualitySettings }>) => void;
  onClose: () => void;
  onAIRenameAll?: () => void;
  isAIRenaming?: boolean;
  onCompressPdfs?: () => void;
  onCreatePdfFromImages?: () => void;
  onCreateSearchablePdfFromImages?: () => void;
  onMergePdfs?: () => void;
  onRenderPdfPagesToImages?: () => void;
  onReorderPdf?: (pageOrder: string) => void;
  onRotatePdfs?: (degrees: 90 | 180 | 270) => void;
  onSplitPdfs?: () => void;
}

export const SelectionPanel = ({
  open,
  selectedCount,
  selectedType,
  onApply,
  onClose,
  onAIRenameAll,
  isAIRenaming,
  onCompressPdfs,
  onCreatePdfFromImages,
  onCreateSearchablePdfFromImages,
  onMergePdfs,
  onRenderPdfPagesToImages,
  onReorderPdf,
  onRotatePdfs,
  onSplitPdfs,
}: SelectionPanelProps) => {
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(100);
  const [maxSizeKB, setMaxSizeKB] = useState(500);
  const [pageOrder, setPageOrder] = useState('');

  // Reset when the selection panel opens.
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
  const presets = selectedType && !isPdfSelection ? getConversionPresets(selectedType) : [];
  const laneName = selectedType === 'image' ? 'Bild' : selectedType === 'video' ? 'Video' : 'PDF';
  const lanePlural = selectedType === 'image' ? 'Bilder' : selectedType === 'video' ? 'Videos' : 'PDFs';
  const selectionTitle = selectedType
    ? selectedCount === 1
      ? `1 ${laneName} ausgewählt`
      : `${selectedCount} ${lanePlural} ausgewählt`
    : `${selectedCount} Datei${selectedCount !== 1 ? 'en' : ''} ausgewählt`;

  return (
    <aside
      role="region"
      aria-labelledby="bulk-settings-title"
      className="ms-panel overflow-hidden bg-[var(--ms-card)]"
    >
      <div className="ms-hairline-bottom flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <span className="ms-chip ms-chip-accent">Auswahl</span>
          <h2 id="bulk-settings-title" className="ms-h4 mt-2">
            {selectionTitle}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Auswahl lösen
        </Button>
      </div>

      <div className="space-y-4 bg-[var(--ms-cream)] p-4">
        {onAIRenameAll && !isPdfSelection && (
          <div className="flex items-center justify-between gap-3 border-y border-[var(--ms-hairline)] py-3">
            <div className="flex items-center gap-2">
              <RenameSparkIcon className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium">KI-Umbenennung</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onAIRenameAll}
              disabled={isAIRenaming}
              className="h-9 w-9"
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
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ms-radius-card-small)] bg-[var(--ms-accent-tint)] text-accent">
                <BatchFilesIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">PDFs zu einer Datei machen</h3>
                <p className="ms-note mt-1">
                  Lokal im Browser. Die Reihenfolge in der Liste wird übernommen.
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
              PDFs zu einer Datei machen
            </Button>
            <details className="rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3">
              <summary className="cursor-pointer text-sm font-medium">Weitere PDF-Optionen</summary>
              <div className="mt-3 grid grid-cols-1 gap-2">
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
                  className="gap-2"
                  onClick={onCompressPdfs}
                  disabled={!onCompressPdfs}
                >
                  PDFs kleiner machen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={onRenderPdfPagesToImages}
                  disabled={!onRenderPdfPagesToImages}
                >
                  PDF-Seiten als Bilder speichern
                </Button>
                <div className="space-y-2 pt-2">
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
            </details>
          </div>
        )}

        {selectedType === 'image' && (onCreatePdfFromImages || onCreateSearchablePdfFromImages) && (
          <section className="rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3" aria-label="Handout aus Bildern">
            <h3 className="text-sm font-medium">Handout aus Bildern</h3>
            <div className="mt-3 space-y-3">
              <p className="ms-note mt-1">
                Lokal im Browser aus der Auswahl erstellen.
              </p>
              {onCreatePdfFromImages && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={onCreatePdfFromImages}
                >
                  <BatchFilesIcon className="h-4 w-4" />
                  Bilder als PDF speichern
                </Button>
              )}
              {onCreateSearchablePdfFromImages && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={onCreateSearchablePdfFromImages}
                >
                  <BatchFilesIcon className="h-4 w-4" />
                  Text in PDF suchbar machen
                </Button>
              )}
            </div>
          </section>
        )}

        {!isPdfSelection && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Grösse & Qualität</h3>

          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Schnellauswahl</p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    title={preset.description}
                    onClick={() => {
                      onApply({
                        qualitySettings: applyConversionPreset(
                          { mode, percentage, maxSizeKB, scale: 100 },
                          preset,
                        ),
                      });
                      onClose();
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Tabs value={mode} onValueChange={(v) => setMode(v as QualityMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage" className="gap-2">
                <PercentBadgeIcon className="h-4 w-4" />
                Prozent
              </TabsTrigger>
              <TabsTrigger value="maxSize" className="gap-2">
                <MaxSizeIcon className="h-4 w-4" />
                Zielgrösse
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
                100% = Standard, 200% = Maximum
              </p>
            </TabsContent>

            <TabsContent value="maxSize" className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap">Zielgrösse</Label>
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
                Qualität wird automatisch angepasst, um die Zielgrösse zu erreichen.
              </p>
            </TabsContent>
          </Tabs>
        </div>
        )}
      </div>

      <div className="ms-hairline-top p-4">
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Auswahl lösen
          </Button>
          {!isPdfSelection && (
            <Button onClick={handleApply} className="flex-1">
              Änderungen übernehmen
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};
