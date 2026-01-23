import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileCard } from '@/components/FileCard';
import { RenameToggle } from '@/components/RenameToggle';
import { Stats } from '@/components/Stats';
import { useFileConverter } from '@/hooks/useFileConverter';
import { Button } from '@/components/ui/button';
import { Play, Download } from 'lucide-react';

const Index = () => {
  const { files, addFiles, convertFile, removeFile, downloadFile, updateFileName } = useFileConverter();
  const [renameHelperEnabled, setRenameHelperEnabled] = useState(false);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const addedFiles = addFiles(newFiles);
      
      // Auto-start conversion for each file
      addedFiles.forEach((file) => {
        convertFile(file);
      });
    },
    [addFiles, convertFile]
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

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Drop Zone */}
          <DropZone onFilesAdded={handleFilesAdded} />

          {/* Rename Helper Toggle */}
          <RenameToggle
            enabled={renameHelperEnabled}
            onToggle={setRenameHelperEnabled}
            disabled={true} // Will be enabled when Cloud is connected
          />

          {/* Stats */}
          <Stats files={files} />

          {/* Bulk Actions */}
          {files.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {files.length} Datei{files.length !== 1 ? 'en' : ''} geladen
              </p>
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
              </div>
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
                renameHelperEnabled={renameHelperEnabled}
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
