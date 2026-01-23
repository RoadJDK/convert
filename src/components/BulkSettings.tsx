import { useState } from 'react';
import { Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QualitySettings, QualityMode, ConvertibleFile } from '@/types/converter';

interface BulkSettingsProps {
  files: ConvertibleFile[];
  onApply: (fileIds: string[], settings: Partial<{ qualitySettings: QualitySettings }>) => void;
}

export const BulkSettings = ({ files, onApply }: BulkSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<QualityMode>('percentage');
  const [percentage, setPercentage] = useState(85);
  const [maxSizeKB, setMaxSizeKB] = useState(500);

  const pendingFiles = files.filter((f) => f.status === 'pending');

  const toggleFile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(pendingFiles.map((f) => f.id));
  };

  const handleApply = () => {
    if (selectedIds.length === 0) return;
    
    onApply(selectedIds, {
      qualitySettings: { mode, percentage, maxSizeKB },
    });
    setOpen(false);
    setSelectedIds([]);
  };

  if (pendingFiles.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          Gruppen-Einstellungen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Einstellungen für mehrere Dateien
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Dateien auswählen</Label>
              <Button variant="link" size="sm" onClick={selectAll} className="h-auto p-0">
                Alle auswählen
              </Button>
            </div>
            <div className="max-h-32 overflow-auto space-y-2 rounded-md border p-2">
              {pendingFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-2">
                  <Checkbox
                    id={file.id}
                    checked={selectedIds.includes(file.id)}
                    onCheckedChange={() => toggleFile(file.id)}
                  />
                  <label
                    htmlFor={file.id}
                    className="text-sm truncate cursor-pointer flex-1"
                  >
                    {file.originalName}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Quality settings */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as QualityMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage">Prozent</TabsTrigger>
              <TabsTrigger value="maxSize">Max Größe</TabsTrigger>
            </TabsList>

            <TabsContent value="percentage" className="mt-4 space-y-3">
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

            <TabsContent value="maxSize" className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Max Größe</Label>
                <Input
                  type="number"
                  value={maxSizeKB}
                  onChange={(e) => setMaxSizeKB(parseInt(e.target.value, 10) || 500)}
                  className="h-8"
                  min={10}
                />
                <span className="text-xs text-muted-foreground">KB</span>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={selectedIds.length === 0}>
            Auf {selectedIds.length} Dateien anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
