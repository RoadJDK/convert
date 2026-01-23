import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileCard } from '@/components/FileCard';
import { Stats } from '@/components/Stats';
import { BulkSettingsBar } from '@/components/BulkSettingsBar';
import { CropDialog } from '@/components/CropDialog';
import { useFileConverter } from '@/hooks/useFileConverter';
import { useAIRename } from '@/hooks/useAIRename';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Download, Trash2 } from 'lucide-react';
import { ConvertibleFile, CropArea, QualitySettings } from '@/types/converter';

const Index = () => {
  const { 
    files, 
    addFiles, 
    convertFile, 
    removeFile, 
    downloadFile, 
    updateFileName,
    updateFileSettings,
    updateFileCrop,
    updateBulkSettings,
    clearAllFiles,
  } = useFileConverter();
  
  const { generateName, isLoading: aiRenameLoading } = useAIRename();
  const [renameHelperEnabled, setRenameHelperEnabled] = useState(false);
  const [cropDialogFile, setCropDialogFile] = useState<ConvertibleFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingFiles = useMemo(() => files.filter(f => f.status === 'pending'), [files]);
  const selectedPendingIds = useMemo(() => 
    selectedIds.filter(id => pendingFiles.some(f => f.id === id)), 
    [selectedIds, pendingFiles]
  );

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles);
    },
    [addFiles]
  );

  const handleConvertAll = useCallback(() => {
    files
      .filter((f) => f.status === 'pending')
      .forEach((file) => convertFile(file));
  }, [files, convertFile]);

  const handleDownloadAll = useCallback(() => {
    files
      .filter((f) => f.status === 'completed')
      .forEach((file) => downloadFile(file));
  }, [files, downloadFile]);

  const handleClearAll = useCallback(() => {
    clearAllFiles();
    setSelectedIds([]);
  }, [clearAllFiles]);

  const handleCropApply = useCallback((cropArea: CropArea | undefined, dimensions?: { width: number; height: number }) => {
    if (cropDialogFile) {
      updateFileCrop(cropDialogFile.id, cropArea, dimensions);
    }
  }, [cropDialogFile, updateFileCrop]);

  const handleBulkApply = useCallback((updates: Partial<{ qualitySettings: QualitySettings }>) => {
    if (selectedPendingIds.length > 0) {
      updateBulkSettings(selectedPendingIds, updates);
    }
  }, [selectedPendingIds, updateBulkSettings]);

  const handleSelectFile = useCallback((fileId: string, selected: boolean) => {
    setSelectedIds(prev => 
      selected ? [...prev, fileId] : prev.filter(id => id !== fileId)
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPendingIds.length === pendingFiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingFiles.map(f => f.id));
    }
  }, [selectedPendingIds.length, pendingFiles]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleAIRename = useCallback(async (file: ConvertibleFile) => {
    const baseName = file.originalName.replace(/\.[^/.]+$/, '');
    const newName = await generateName(file.id, baseName, file.type);
    if (newName) {
      updateFileName(file.id, newName);
    }
  }, [generateName, updateFileName]);

  const handleAIRenameSelected = useCallback(async () => {
    const filesToRename = pendingFiles.filter(f => selectedPendingIds.includes(f.id));
    for (const file of filesToRename) {
      await handleAIRename(file);
    }
  }, [pendingFiles, selectedPendingIds, handleAIRename]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const isAnyAIRenaming = Object.values(aiRenameLoading).some(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Drop Zone */}
          <DropZone onFilesAdded={handleFilesAdded} />

          {/* Stats */}
          <Stats files={files} />

          {/* Bulk Actions */}
          {files.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-card p-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {files.length} Datei{files.length !== 1 ? 'en' : ''} geladen
                </p>
              </div>
              <div className="flex gap-2">
                {pendingCount > 0 && (
                  <Button size="sm" variant="secondary" onClick={handleConvertAll} className="gap-2">
                    <Play className="h-4 w-4" />
                    Alle starten ({pendingCount})
                  </Button>
                )}
                {completedCount > 0 && (
                  <Button 
                    size="sm" 
                    onClick={handleDownloadAll} 
                    className="gap-2 bg-success text-success-foreground hover:bg-success/90"
                  >
                    <Download className="h-4 w-4" />
                    Alle downloaden ({completedCount})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Alle löschen
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Settings Bar (shown when files selected) */}
          {pendingFiles.length > 0 && (
            <BulkSettingsBar
              selectedCount={selectedPendingIds.length}
              onApply={handleBulkApply}
              onClear={handleClearSelection}
              onAIRenameAll={handleAIRenameSelected}
              isAIRenaming={isAnyAIRenaming}
              renameHelperEnabled={renameHelperEnabled}
              onToggleRenameHelper={setRenameHelperEnabled}
            />
          )}

          {/* Select All (only when there are pending files) */}
          {pendingFiles.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={selectedPendingIds.length === pendingFiles.length && pendingFiles.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground cursor-pointer" onClick={handleSelectAll}>
                Alle auswählen
              </span>
            </div>
          )}

          {/* File List */}
          <div className="space-y-3">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onConvert={() => convertFile(file)}
                onRemove={() => removeFile(file.id)}
                onDownload={(customName) => downloadFile(file, customName)}
                onRename={(newName) => updateFileName(file.id, newName)}
                onSettingsChange={(settings) => updateFileSettings(file.id, settings)}
                onCropClick={() => setCropDialogFile(file)}
                onAIRename={() => handleAIRename(file)}
                isAIRenaming={aiRenameLoading[file.id]}
                renameHelperEnabled={renameHelperEnabled}
                onToggleRenameHelper={setRenameHelperEnabled}
                selected={selectedIds.includes(file.id)}
                onSelectChange={(selected) => handleSelectFile(file.id, selected)}
                showCheckbox={file.status === 'pending'}
              />
            ))}
          </div>

          {/* Empty State */}
          {files.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
              <p className="text-muted-foreground">
                Lade Bilder oder Videos hoch um zu starten
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Crop Dialog */}
      <CropDialog
        file={cropDialogFile}
        open={!!cropDialogFile}
        onClose={() => setCropDialogFile(null)}
        onApply={handleCropApply}
      />

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Konvertierung erfolgt lokal in deinem Browser • Keine Dateien werden hochgeladen
        </div>
      </footer>
    </div>
  );
};

export default Index;