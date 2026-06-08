import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileCard } from '@/components/FileCard';
import { BulkSettingsSidebar } from '@/components/BulkSettingsSidebar';
import { CropDialog } from '@/components/CropDialog';
import { SelectAllControls } from '@/components/SelectAllControls';
import { WorkspaceIntro } from '@/components/workspace/WorkspaceIntro';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { useFileConverter } from '@/hooks/useFileConverter';
import { useAIRename } from '@/hooks/useAIRename';
import { CleanupMask, ConvertibleFile, CropArea, QualitySettings, TrimRange, FileType, VideoRotation } from '@/types/converter';
import { runLimitedConcurrency } from '@/lib/conversionQueue';
import { imageFilesToPdf } from '@/lib/imageToPdf';
import { renderPdfPagesToPng } from '@/lib/pdfPageRendering';
import { createSearchablePdfFromImages } from '@/lib/searchablePdf';
import {
  compressPdfFile,
  mergePdfFiles,
  reorderPdfFile,
  rotatePdfFile,
  splitPdfFile,
  type PdfRotationDegrees,
} from '@/lib/pdfOperations';

const LOCAL_CONVERSION_CONCURRENCY = 2;

const getPdfBaseName = (file: ConvertibleFile): string => {
  return (file.suggestedName || file.originalName.replace(/\.[^/.]+$/, '')).trim() || 'document';
};

const parsePdfPageOrder = (value: string): number[] => {
  const pageNumbers = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));

  if (pageNumbers.length === 0 || pageNumbers.some((pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1)) {
    throw new Error('Seitenfolge muss Seitenzahlen wie 3,1,2 enthalten.');
  }

  return pageNumbers.map((pageNumber) => pageNumber - 1);
};

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
  const [cleanupDialogFile, setCleanupDialogFile] = useState<ConvertibleFile | null>(null);
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

  const selectedPdfFiles = useMemo(
    () => pendingFiles.filter((file) => selectedPendingIds.includes(file.id) && file.type === 'pdf'),
    [pendingFiles, selectedPendingIds],
  );

  const selectedImageFiles = useMemo(
    () => pendingFiles.filter((file) => selectedPendingIds.includes(file.id) && file.type === 'image'),
    [pendingFiles, selectedPendingIds],
  );

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      addFiles(newFiles);
    },
    [addFiles]
  );

  const handleConvertAll = useCallback(() => {
    const filesToConvert = files.filter((f) => f.status === 'pending');
    void runLimitedConcurrency(
      filesToConvert,
      async (file) => {
        await convertFile(file);
      },
      { concurrency: LOCAL_CONVERSION_CONCURRENCY },
    );
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
    trimRange?: TrimRange,
    videoRotation?: VideoRotation
  ) => {
    if (cropDialogFile) {
      updateFileCrop(cropDialogFile.id, cropArea, dimensions, trimRange, videoRotation);
    }
  }, [cropDialogFile, updateFileCrop]);

  const handleCleanupAreaApply = useCallback((
    cleanupArea: CropArea | undefined,
    _dimensions?: { width: number; height: number },
    _trimRange?: TrimRange,
    _videoRotation?: VideoRotation,
    cleanupMask?: CleanupMask,
  ) => {
    if (cleanupDialogFile) {
      const hasCleanupMask = Boolean(cleanupMask?.strokes.length);
      updateFile(cleanupDialogFile.id, {
        cleanupArea: hasCleanupMask ? undefined : cleanupArea,
        cleanupMask,
        removeWatermark: Boolean(cleanupArea || hasCleanupMask),
      });
    }
  }, [cleanupDialogFile, updateFile]);

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
    if (file.type === 'pdf') return;

    const baseName = file.originalName.replace(/\.[^/.]+$/, '');
    const newName = await generateName(file.id, baseName, file.type, file.file);
    if (newName) {
      updateFileName(file.id, newName);
    }
  }, [generateName, updateFileName]);

  const handleAIRenameSelected = useCallback(async () => {
    const filesToRename = pendingFiles.filter(f => selectedPendingIds.includes(f.id) && f.type !== 'pdf');
    for (const file of filesToRename) {
      await handleAIRename(file);
    }
  }, [pendingFiles, selectedPendingIds, handleAIRename]);

  const addCompletedPdfResult = useCallback((blob: Blob, suggestedName: string) => {
    const pdfFile = new File([blob], `${suggestedName}.pdf`, { type: 'application/pdf' });
    const [createdFile] = addFiles([pdfFile]);
    if (!createdFile) return;

    updateFile(createdFile.id, {
      status: 'completed',
      progress: 100,
      convertedBlob: blob,
      convertedUrl: URL.createObjectURL(blob),
      convertedSize: blob.size,
      suggestedName,
    });
  }, [addFiles, updateFile]);

  const addCompletedPngResult = useCallback((blob: Blob, suggestedName: string) => {
    const imageFile = new File([blob], `${suggestedName}.png`, { type: 'image/png' });
    const [createdFile] = addFiles([imageFile]);
    if (!createdFile) return;

    updateFile(createdFile.id, {
      status: 'completed',
      progress: 100,
      convertedBlob: blob,
      convertedUrl: URL.createObjectURL(blob),
      convertedSize: blob.size,
      qualitySettings: { ...createdFile.qualitySettings, outputFormat: 'png' },
      suggestedName,
    });
  }, [addFiles, updateFile]);

  const handleMergeSelectedPdfs = useCallback(async () => {
    if (selectedPdfFiles.length < 2) return;

    try {
      const mergedBlob = await mergePdfFiles(selectedPdfFiles.map((file) => file.file));
      addCompletedPdfResult(mergedBlob, `merged-${selectedPdfFiles.length}-pdfs`);
      setSelectedIds([]);
    } catch (error) {
      updateFile(selectedPdfFiles[0].id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'PDFs konnten nicht lokal zusammengeführt werden.',
      });
    }
  }, [addCompletedPdfResult, selectedPdfFiles, updateFile]);

  const handlePdfOperationError = useCallback((file: ConvertibleFile, error: unknown, fallback: string) => {
    updateFile(file.id, {
      status: 'error',
      error: error instanceof Error ? error.message : fallback,
    });
  }, [updateFile]);

  const handleSplitSelectedPdfs = useCallback(async () => {
    for (const file of selectedPdfFiles) {
      try {
        const pages = await splitPdfFile(file.file);
        pages.forEach((page) => addCompletedPdfResult(page.blob, page.suggestedName));
      } catch (error) {
        handlePdfOperationError(file, error, 'PDF konnte nicht lokal aufgeteilt werden.');
      }
    }
    setSelectedIds([]);
  }, [addCompletedPdfResult, handlePdfOperationError, selectedPdfFiles]);

  const handleRotateSelectedPdfs = useCallback(async (rotation: PdfRotationDegrees) => {
    for (const file of selectedPdfFiles) {
      try {
        const rotated = await rotatePdfFile(file.file, rotation);
        addCompletedPdfResult(rotated, `${getPdfBaseName(file)}-rotated-${rotation}`);
      } catch (error) {
        handlePdfOperationError(file, error, 'PDF konnte nicht lokal gedreht werden.');
      }
    }
    setSelectedIds([]);
  }, [addCompletedPdfResult, handlePdfOperationError, selectedPdfFiles]);

  const handleCompressSelectedPdfs = useCallback(async () => {
    for (const file of selectedPdfFiles) {
      try {
        const compressed = await compressPdfFile(file.file);
        addCompletedPdfResult(compressed, `${getPdfBaseName(file)}-compressed`);
      } catch (error) {
        handlePdfOperationError(file, error, 'PDF konnte nicht lokal komprimiert werden.');
      }
    }
    setSelectedIds([]);
  }, [addCompletedPdfResult, handlePdfOperationError, selectedPdfFiles]);

  const handleRenderSelectedPdfPagesToImages = useCallback(async () => {
    for (const file of selectedPdfFiles) {
      try {
        const images = await renderPdfPagesToPng(file.file);
        images.forEach((image) => addCompletedPngResult(image.blob, image.suggestedName));
      } catch (error) {
        handlePdfOperationError(file, error, 'PDF-Seiten konnten nicht lokal als PNG gerendert werden.');
      }
    }
    setSelectedIds([]);
  }, [addCompletedPngResult, handlePdfOperationError, selectedPdfFiles]);

  const handleReorderSelectedPdf = useCallback(async (pageOrder: string) => {
    const [file] = selectedPdfFiles;
    if (!file) return;

    try {
      const reordered = await reorderPdfFile(file.file, parsePdfPageOrder(pageOrder));
      addCompletedPdfResult(reordered, `${getPdfBaseName(file)}-reordered`);
      setSelectedIds([]);
    } catch (error) {
      handlePdfOperationError(file, error, 'PDF konnte nicht lokal neu sortiert werden.');
    }
  }, [addCompletedPdfResult, handlePdfOperationError, selectedPdfFiles]);

  const handleCreatePdfFromSelectedImages = useCallback(async () => {
    if (selectedImageFiles.length === 0) return;

    try {
      const pdf = await imageFilesToPdf(selectedImageFiles.map((file) => file.file));
      addCompletedPdfResult(pdf, `images-${selectedImageFiles.length}-pages`);
      setSelectedIds([]);
    } catch (error) {
      updateFile(selectedImageFiles[0].id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Bilder konnten nicht lokal als PDF gebündelt werden.',
      });
    }
  }, [addCompletedPdfResult, selectedImageFiles, updateFile]);

  const handleCreateSearchablePdfFromSelectedImages = useCallback(async () => {
    if (selectedImageFiles.length === 0) return;

    try {
      const pdf = await createSearchablePdfFromImages(selectedImageFiles.map((file) => file.file));
      addCompletedPdfResult(pdf, `ocr-${selectedImageFiles.length}-pages`);
      setSelectedIds([]);
    } catch (error) {
      updateFile(selectedImageFiles[0].id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'OCR-PDF konnte nicht lokal erstellt werden.',
      });
    }
  }, [addCompletedPdfResult, selectedImageFiles, updateFile]);

  const handleToggleRemoveBackground = useCallback((fileId: string, enabled: boolean) => {
    updateFile(fileId, { removeBackground: enabled });
  }, [updateFile]);

  const handleToggleRemoveWatermark = useCallback((fileId: string, enabled: boolean) => {
    updateFile(fileId, enabled ? { removeWatermark: true } : { removeWatermark: false, cleanupArea: undefined, cleanupMask: undefined });
  }, [updateFile]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const isAnyAIRenaming = Object.values(aiRenameLoading).some(Boolean);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-transparent">
      <Header />

      <main id="workspace" className="container mx-auto flex-1 px-4 pb-8 pt-28 sm:pb-10 sm:pt-32">
        <div className="mx-auto max-w-7xl">
          <WorkspaceIntro />

          {/* Bulk Settings Sidebar (slides in from right when files selected) */}
          <BulkSettingsSidebar
            open={selectedPendingIds.length > 0}
            selectedCount={selectedPendingIds.length}
            selectedType={selectedFileType}
            onApply={handleBulkApply}
            onClose={handleClearSelection}
            onAIRenameAll={selectedFileType === 'pdf' ? undefined : handleAIRenameSelected}
            isAIRenaming={isAnyAIRenaming}
            onCompressPdfs={handleCompressSelectedPdfs}
            onCreatePdfFromImages={handleCreatePdfFromSelectedImages}
            onCreateSearchablePdfFromImages={handleCreateSearchablePdfFromSelectedImages}
            onMergePdfs={handleMergeSelectedPdfs}
            onRenderPdfPagesToImages={handleRenderSelectedPdfPagesToImages}
            onReorderPdf={handleReorderSelectedPdf}
            onRotatePdfs={handleRotateSelectedPdfs}
            onSplitPdfs={handleSplitSelectedPdfs}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              <DropZone hasFiles={files.length > 0} onFilesAdded={handleFilesAdded} />

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
                    onAIRename={file.type === 'pdf' ? undefined : () => handleAIRename(file)}
                    isAIRenaming={aiRenameLoading[file.id]}
                    selected={selectedIds.includes(file.id)}
                    onSelectChange={(selected) => handleSelectFile(file.id, selected)}
                    showCheckbox={file.status === 'pending'}
                    videoPreviewUrl={videoPreviews[file.id]}
                    onReset={() => resetFile(file.id)}
                    removeBackgroundEnabled={file.removeBackground}
                    onToggleRemoveBackground={(enabled) => handleToggleRemoveBackground(file.id, enabled)}
                    removeWatermarkEnabled={file.removeWatermark}
                    onToggleRemoveWatermark={(enabled) => handleToggleRemoveWatermark(file.id, enabled)}
                    onCleanupAreaClick={() => setCleanupDialogFile(file)}
                  />
                ))}
              </div>

              {files.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.035] p-8 text-center sm:p-12">
                  <p className="text-sm text-muted-foreground">
                    Noch keine Dateien. Zieh Bilder, Videos oder PDFs in die Fläche oben.
                  </p>
                </div>
              )}
            </section>

            <WorkspaceSidebar
              completedCount={completedCount}
              files={files}
              pendingCount={pendingCount}
              onClearAll={handleClearAll}
              onConvertAll={handleConvertAll}
              onDownloadAll={handleDownloadAll}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-transparent py-5">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row">
          <img src="/assets/logo-full-white.svg" alt="Maibach Systems" className="h-10 w-auto opacity-80" width="360" height="112" />
          <span>Lokal im Browser. Kein Upload für Konvertierung, PDF-Werkzeuge oder Rename.</span>
        </div>
      </footer>

      {/* Crop Dialog */}
      <CropDialog
        file={cropDialogFile}
        mode="crop"
        open={!!cropDialogFile}
        onClose={() => setCropDialogFile(null)}
        onApply={handleCropApply}
      />
      <CropDialog
        file={cleanupDialogFile}
        mode="cleanup"
        open={!!cleanupDialogFile}
        onClose={() => setCleanupDialogFile(null)}
        onApply={handleCleanupAreaApply}
      />
    </div>
  );
};

export default Index;
