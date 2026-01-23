import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileCard } from '@/components/FileCard';
import { Stats } from '@/components/Stats';
import { BulkSettingsSidebar } from '@/components/BulkSettingsSidebar';
import { CropDialog } from '@/components/CropDialog';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { SelectAllControls } from '@/components/SelectAllControls';
import { useFileConverter } from '@/hooks/useFileConverter';
import { useAIRename } from '@/hooks/useAIRename';
import { Button } from '@/components/ui/button';
import { Play, Trash2 } from 'lucide-react';
import { ConvertibleFile, CropArea, QualitySettings, TrimRange, FileType } from '@/types/converter';

const Index = () => {
  const { 
    files, 
    videoPreviews,
    addFiles, 
    convertFile, 
    removeFile,
    resetFile,
    downloadFile, 
    updateFileName,
    updateFileSettings,
    updateFileCrop,
    updateBulkSettings,
    clearAllFiles,
    updateFile,
  } = useFileConverter();
  
  const { generateName, isLoading: aiRenameLoading } = useAIRename();
  
  const [cropDialogFile, setCropDialogFile] = useState<ConvertibleFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingFiles = useMemo(() => files.filter(f => f.status === 'pending'), [files]);
  const selectedPendingIds = useMemo(() => 
    selectedIds.filter(id => pendingFiles.some(f => f.id === id)), 
    [selectedIds, pendingFiles]
  );
  
  // Determine the type of currently selected files (for exclusive selection)
  const selectedFileType = useMemo((): FileType | null => {
    if (selectedPendingIds.length === 0) return null;
    const firstSelected = pendingFiles.find(f => selectedPendingIds.includes(f.id));
    return firstSelected?.type || null;
  }, [selectedPendingIds, pendingFiles]);

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

  const handleCropApply = useCallback((
    cropArea: CropArea | undefined, 
    dimensions?: { width: number; height: number },
    trimRange?: TrimRange
  ) => {
    if (cropDialogFile) {
      updateFileCrop(cropDialogFile.id, cropArea, dimensions, trimRange);
    }
  }, [cropDialogFile, updateFileCrop]);

  const handleBulkApply = useCallback((updates: Partial<{ qualitySettings: QualitySettings }>) => {
    if (selectedPendingIds.length > 0) {
      updateBulkSettings(selectedPendingIds, updates);
      setSelectedIds([]); // Clear selection after applying
    }
  }, [selectedPendingIds, updateBulkSettings]);

  const handleSelectFile = useCallback((fileId: string, selected: boolean) => {
    if (!selected) {
      // Deselecting is always allowed
      setSelectedIds(prev => prev.filter(id => id !== fileId));
      return;
    }
    
    // Get the type of the file being selected
    const fileToSelect = pendingFiles.find(f => f.id === fileId);
    if (!fileToSelect) return;
    
    // If there are already selected files of a different type, clear them first
    if (selectedFileType && selectedFileType !== fileToSelect.type) {
      // Clear selection and select only this new file
      setSelectedIds([fileId]);
    } else {
      // Same type or no selection yet, add to selection
      setSelectedIds(prev => [...prev, fileId]);
    }
  }, [pendingFiles, selectedFileType]);

  const handleSelectAll = useCallback(() => {
    // Select all of the same type as currently selected, or all images if nothing selected
    const targetType = selectedFileType || 'image';
    const filesOfType = pendingFiles.filter(f => f.type === targetType);
    
    if (selectedPendingIds.length === filesOfType.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filesOfType.map(f => f.id));
    }
  }, [selectedPendingIds.length, pendingFiles, selectedFileType]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleAIRename = useCallback(async (file: ConvertibleFile) => {
    const baseName = file.originalName.replace(/\.[^/.]+$/, '');
    const newName = await generateName(file.id, baseName, file.type, file.file);
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

  const handleToggleRemoveBackground = useCallback((fileId: string, enabled: boolean) => {
    updateFile(fileId, { removeBackground: enabled });
  }, [updateFile]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const isAnyAIRenaming = Object.values(aiRenameLoading).some(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
          {/* Drop Zone */}
          <DropZone onFilesAdded={handleFilesAdded} />

          {/* Stats */}
          <Stats files={files} />

          {/* Bulk Actions */}
          {files.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-card p-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {files.length} Datei{files.length !== 1 ? 'en' : ''} geladen
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                {pendingCount > 0 && (
                  <Button size="sm" variant="secondary" onClick={handleConvertAll} className="gap-2 flex-1 sm:flex-initial">
                    <Play className="h-4 w-4" />
                    <span className="hidden sm:inline">Alle starten</span>
                    <span className="sm:hidden">Starten</span>
                    ({pendingCount})
                  </Button>
                )}
                {completedCount > 0 && (
                  <DownloadDropdown 
                    files={files}
                    onDownloadIndividual={handleDownloadAll}
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  className="gap-2 text-destructive hover:text-destructive flex-1 sm:flex-initial"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Alle löschen</span>
                  <span className="sm:hidden">Löschen</span>
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Settings Sidebar (slides in from right when files selected) */}
          <BulkSettingsSidebar
            open={selectedPendingIds.length > 0}
            selectedCount={selectedPendingIds.length}
            onApply={handleBulkApply}
            onClose={handleClearSelection}
            onAIRenameAll={handleAIRenameSelected}
            isAIRenaming={isAnyAIRenaming}
          />

          {/* Select All (only when there are pending files) */}
          {pendingFiles.length > 1 && (
            <SelectAllControls
              pendingFiles={pendingFiles}
              selectedPendingIds={selectedPendingIds}
              onSelectType={(type) => {
                const filesOfType = pendingFiles.filter(f => f.type === type);
                setSelectedIds(filesOfType.map(f => f.id));
              }}
              onClearSelection={() => setSelectedIds([])}
            />
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
                selected={selectedIds.includes(file.id)}
                onSelectChange={(selected) => handleSelectFile(file.id, selected)}
                showCheckbox={file.status === 'pending'}
                videoPreviewUrl={videoPreviews[file.id]}
                onReset={() => resetFile(file.id)}
                removeBackgroundEnabled={file.removeBackground}
                onToggleRemoveBackground={(enabled) => handleToggleRemoveBackground(file.id, enabled)}
              />
            ))}
          </div>

          {/* Empty State */}
          {files.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 sm:p-12 text-center">
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