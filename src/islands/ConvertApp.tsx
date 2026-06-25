import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileCard } from '@/components/FileCard';
import { SelectionPanel } from '@/components/SelectionPanel';
import { CropDialog } from '@/components/CropDialog';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { useFileConverter } from '@/hooks/useFileConverter';
import { useAIRename } from '@/hooks/useAIRename';
import { CleanupMask, ConvertibleFile, CropArea, QualitySettings, TrimRange, FileType, VideoRotation } from '@/types/converter';
import { runLimitedConcurrency } from '@/lib/conversionQueue';
import { imageFilesToPdf } from '@/lib/imageToPdf';
import { renderPdfPagesToPng } from '@/lib/pdfPageRendering';
import { createSearchablePdfFromImages } from '@/lib/searchablePdf';
import { applyConversionPreset, getConversionPresets } from '@/lib/conversionPresets';
import {
  compressPdfFile,
  mergePdfFiles,
  reorderPdfFile,
  rotatePdfFile,
  splitPdfFile,
  type PdfRotationDegrees,
} from '@/lib/pdfOperations';
import {
  BatchFilesIcon,
  ConvertPlayIcon,
  ImageFormatIcon,
  VideoTimelineIcon,
} from '@/components/icons/MediaConvertIcons';

const LOCAL_CONVERSION_CONCURRENCY = 1;
const MEDIA_LANES: FileType[] = ['image', 'video', 'pdf'];
const EMAIL_IMAGE_PRESET = getConversionPresets('image').find((preset) => preset.id === 'image-jpeg-small');

const laneMeta: Record<FileType, {
  label: string;
  marker: string;
  empty: string;
  Icon: typeof ImageFormatIcon;
}> = {
  image: {
    label: 'Bilder',
    marker: 'Bilddateien',
    empty: 'Bilder erscheinen hier, sobald sie importiert sind.',
    Icon: ImageFormatIcon,
  },
  video: {
    label: 'Videos',
    marker: 'Videodateien',
    empty: 'Videos erscheinen hier, sobald sie importiert sind.',
    Icon: VideoTimelineIcon,
  },
  pdf: {
    label: 'PDFs',
    marker: 'PDF-Dokumente',
    empty: 'PDFs erscheinen hier, sobald sie importiert sind.',
    Icon: BatchFilesIcon,
  },
};

const getPdfBaseName = (file: ConvertibleFile): string => {
  return (file.suggestedName || file.originalName.replace(/\.[^/.]+$/, '')).trim() || 'document';
};

const getBatchResultBaseName = (batchFiles: ConvertibleFile[], suffix: string, fallback: string): string => {
  const firstFile = batchFiles[0];
  const baseName = firstFile ? getPdfBaseName(firstFile) : fallback;
  return batchFiles.length > 1 ? `${baseName}-${batchFiles.length}-${suffix}` : `${baseName}-${suffix}`;
};

const parsePdfPageOrder = (value: string): number[] => {
  const pageNumbers = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));

  if (pageNumbers.length === 0 || pageNumbers.some((pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1)) {
    throw new Error('Das ging nicht. Bitte Seitenzahlen wie 3,1,2 eingeben.');
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
  const [activeLane, setActiveLane] = useState<FileType>('image');

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

  const pendingPdfFiles = useMemo(
    () => pendingFiles.filter((file) => file.type === 'pdf'),
    [pendingFiles],
  );

  const pendingImageFiles = useMemo(
    () => pendingFiles.filter((file) => file.type === 'image'),
    [pendingFiles],
  );

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const createdFiles = addFiles(newFiles);
      const firstCreatedFile = createdFiles[0];
      if (firstCreatedFile) {
        setActiveLane(firstCreatedFile.type);
      }
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

  const handleConvertLane = useCallback((type: FileType) => {
    const filesToConvert = files.filter((f) => f.status === 'pending' && f.type === type);
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
    if (!window.confirm('Alle Dateien aus dieser Sitzung entfernen?')) {
      return;
    }

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

  const handleSelectLane = useCallback((type: FileType) => {
    const filesOfType = pendingFiles.filter(f => f.type === type);
    const idsOfType = filesOfType.map(f => f.id);
    const allSelected = idsOfType.length > 0 && idsOfType.every((id) => selectedPendingIds.includes(id));
    setSelectedIds(allSelected ? [] : idsOfType);
  }, [pendingFiles, selectedPendingIds]);

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
    setActiveLane('pdf');
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
    setActiveLane('image');
  }, [addFiles, updateFile]);

  const handlePdfOperationError = useCallback((file: ConvertibleFile, error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    updateFile(file.id, {
      status: 'error',
      error: message.startsWith('Das ging nicht') ? message : `${message} Bitte Datei prüfen oder ohne diese Datei erneut versuchen.`,
    });
  }, [updateFile]);

  const handleMergePdfBatch = useCallback(async (pdfFiles: ConvertibleFile[]) => {
    if (pdfFiles.length < 2) return;

    try {
      const mergedBlob = await mergePdfFiles(pdfFiles.map((file) => file.file));
      addCompletedPdfResult(mergedBlob, getBatchResultBaseName(pdfFiles, 'pdfs', 'dokumente'));
    } catch (error) {
      handlePdfOperationError(pdfFiles[0], error, 'PDFs konnten nicht lokal zusammengeführt werden.');
    }
  }, [addCompletedPdfResult, handlePdfOperationError]);

  const handleMergeSelectedPdfs = useCallback(async () => {
    await handleMergePdfBatch(selectedPdfFiles);
    setSelectedIds([]);
  }, [handleMergePdfBatch, selectedPdfFiles]);

  const handleMergeAllPendingPdfs = useCallback(async () => {
    await handleMergePdfBatch(pendingPdfFiles);
  }, [handleMergePdfBatch, pendingPdfFiles]);

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
        handlePdfOperationError(file, error, 'PDF-Seiten konnten nicht lokal als Bilder gespeichert werden.');
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

  const handleCreatePdfFromImageBatch = useCallback(async (imageFiles: ConvertibleFile[]) => {
    if (imageFiles.length === 0) return;

    try {
      const pdf = await imageFilesToPdf(imageFiles.map((file) => file.file));
      addCompletedPdfResult(pdf, getBatchResultBaseName(imageFiles, 'bilder-pdf', 'bilder'));
    } catch (error) {
      updateFile(imageFiles[0].id, {
        status: 'error',
        error: error instanceof Error
          ? `${error.message} Bitte Bilder prüfen oder ohne diese Datei erneut versuchen.`
          : 'Bilder konnten nicht lokal als PDF gespeichert werden. Bitte Bilder prüfen oder ohne diese Datei erneut versuchen.',
      });
    }
  }, [addCompletedPdfResult, updateFile]);

  const handleCreatePdfFromSelectedImages = useCallback(async () => {
    await handleCreatePdfFromImageBatch(selectedImageFiles);
    setSelectedIds([]);
  }, [handleCreatePdfFromImageBatch, selectedImageFiles]);

  const handleCreatePdfFromAllImages = useCallback(async () => {
    await handleCreatePdfFromImageBatch(pendingImageFiles);
  }, [handleCreatePdfFromImageBatch, pendingImageFiles]);

  const handleCreateSearchablePdfFromImageBatch = useCallback(async (imageFiles: ConvertibleFile[]) => {
    if (imageFiles.length === 0) return;

    try {
      const pdf = await createSearchablePdfFromImages(imageFiles.map((file) => file.file));
      addCompletedPdfResult(pdf, getBatchResultBaseName(imageFiles, 'text-pdf', 'bilder'));
    } catch (error) {
      updateFile(imageFiles[0].id, {
        status: 'error',
        error: error instanceof Error
          ? `${error.message} Bitte Bilder prüfen oder ohne diese Datei erneut versuchen.`
          : 'Text-PDF konnte nicht lokal erstellt werden. Bitte Bilder prüfen oder ohne diese Datei erneut versuchen.',
      });
    }
  }, [addCompletedPdfResult, updateFile]);

  const handleCreateSearchablePdfFromSelectedImages = useCallback(async () => {
    await handleCreateSearchablePdfFromImageBatch(selectedImageFiles);
    setSelectedIds([]);
  }, [handleCreateSearchablePdfFromImageBatch, selectedImageFiles]);

  const handleCreateSearchablePdfFromAllImages = useCallback(async () => {
    await handleCreateSearchablePdfFromImageBatch(pendingImageFiles);
  }, [handleCreateSearchablePdfFromImageBatch, pendingImageFiles]);

  const handleMakeImagesEmailReady = useCallback(() => {
    if (!EMAIL_IMAGE_PRESET || pendingImageFiles.length === 0) return;

    const baseSettings = pendingImageFiles[0].qualitySettings;
    const emailSettings = applyConversionPreset(
      { ...baseSettings, scale: baseSettings.scale ?? 100 },
      EMAIL_IMAGE_PRESET,
    );
    const filesToConvert = pendingImageFiles.map((file) => ({
      ...file,
      qualitySettings: emailSettings,
    }));

    updateBulkSettings(pendingImageFiles.map((file) => file.id), { qualitySettings: emailSettings });
    setActiveLane('image');
    void runLimitedConcurrency(
      filesToConvert,
      async (file) => {
        await convertFile(file);
      },
      { concurrency: LOCAL_CONVERSION_CONCURRENCY },
    );
  }, [convertFile, pendingImageFiles, updateBulkSettings]);

  const handleToggleRemoveBackground = useCallback((fileId: string, enabled: boolean) => {
    updateFile(fileId, { removeBackground: enabled });
  }, [updateFile]);

  const handleToggleRemoveWatermark = useCallback((fileId: string, enabled: boolean) => {
    updateFile(fileId, enabled ? { removeWatermark: true } : { removeWatermark: false, cleanupArea: undefined, cleanupMask: undefined });
  }, [updateFile]);

  const handleEnableBackgroundRemovalForSelectedImages = useCallback(() => {
    selectedImageFiles.forEach((file) => {
      updateFile(file.id, { removeBackground: true });
    });
  }, [selectedImageFiles, updateFile]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const isAnyAIRenaming = Object.values(aiRenameLoading).some(Boolean);
  const laneSummaries = MEDIA_LANES.map((type) => ({
    type,
    files: files.filter((file) => file.type === type),
    pending: pendingFiles.filter((file) => file.type === type),
    completed: files.filter((file) => file.type === type && file.status === 'completed'),
    selected: selectedPendingIds.filter((id) => pendingFiles.some((file) => file.id === id && file.type === type)),
  }));
  const activeLaneSummary = laneSummaries.find((lane) => lane.type === activeLane) ?? laneSummaries[0];
  const activeMeta = laneMeta[activeLaneSummary.type];
  const activeLaneFiles = activeLaneSummary.files;
  const activePendingCount = activeLaneSummary.pending.length;
  const selectedInActiveLane = activeLaneSummary.selected;
  const hasFiles = files.length > 0;
  const hasCompletedFiles = completedCount > 0;
  const pageTitle = hasFiles
    ? `${files.length} Datei${files.length !== 1 ? 'en' : ''}`
    : 'Dateien rein. Ergebnis raus';

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--ms-paper)]">
      <Header />

      <main id="workspace" className="flex-1 pb-12 pt-[calc(var(--ms-header-height)+18px)] sm:pb-16">
        <div className="ms-rail">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="ms-label-pill">Lokaler Editor</span>
              <h1 className="ms-h2 mt-4 max-w-3xl">
                {pageTitle}<span className="text-accent">.</span>
              </h1>
            </div>
            {hasFiles && (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <span className="ms-chip">{pendingCount} offen</span>
                <span className="ms-chip">{completedCount} fertig</span>
                <span className="ms-chip ms-chip-accent">kein Datei-Upload</span>
              </div>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <div className="ms-panel overflow-hidden">
                <div className="border-b border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3 sm:p-4">
                  <DropZone hasFiles={hasFiles} onFilesAdded={handleFilesAdded} />
                </div>

                <div className="border-b border-[var(--ms-hairline)] bg-[var(--ms-card)] px-3 py-3 sm:px-5">
                  <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Medientyp">
                    {laneSummaries.map((lane) => {
                      const meta = laneMeta[lane.type];
                      const Icon = meta.Icon;
                      const isActive = lane.type === activeLaneSummary.type;

                      return (
                        <button
                          key={lane.type}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveLane(lane.type)}
                          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--ms-radius-pill)] border px-4 text-sm font-medium transition-colors ${
                            isActive
                              ? 'border-[var(--ms-ink)] bg-[var(--ms-stage)] text-[var(--ms-on-stage)]'
                              : 'border-[var(--ms-hairline)] bg-[var(--ms-card)] text-[var(--ms-ink-muted)] hover:border-[var(--ms-ink)] hover:text-[var(--ms-ink)]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{meta.label}</span>
                          <span className={isActive ? 'text-[var(--ms-on-stage-muted)]' : 'text-[var(--ms-ink-faint)]'}>
                            {lane.files.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 bg-[var(--ms-cream)] p-3 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="ms-chip">{activeMeta.marker}</span>
                      <h2 className="ms-h4 mt-2">
                        {activeMeta.label}<span className="text-accent">.</span>
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activePendingCount > 0 && (
                        <button
                          type="button"
                          className="ms-secondary-button inline-flex items-center gap-2 px-4 text-sm font-medium"
                          onClick={() => handleSelectLane(activeLaneSummary.type)}
                        >
                          {activePendingCount === selectedInActiveLane.length ? 'Auswahl lösen' : `Alle wählen (${activePendingCount})`}
                        </button>
                      )}
                      {activePendingCount > 0 && (
                        <button
                          type="button"
                          className="ms-button-swap inline-flex items-center gap-2 text-sm font-medium"
                          onClick={() => handleConvertLane(activeLaneSummary.type)}
                          aria-label={`${activeMeta.label} starten`}
                        >
                          <ConvertPlayIcon className="h-4 w-4" />
                          <span data-label-stack>
                            <span data-default-label>{activeMeta.label} starten</span>
                            <span data-hover-label aria-hidden="true">{activePendingCount} Datei{activePendingCount !== 1 ? 'en' : ''}</span>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {!hasFiles && (
                    <div className="rounded-[var(--ms-radius-card)] border border-dashed border-[var(--ms-hairline)] bg-[var(--ms-card)] p-8 text-center">
                      <span className="ms-chip">Noch leer</span>
                      <p className="ms-body mx-auto mt-3 max-w-md">
                        Foto, Video, PDF oder gemischten Stapel oben ablegen.
                      </p>
                    </div>
                  )}

                  {hasFiles && activeLaneFiles.length === 0 && (
                    <div className="rounded-[var(--ms-radius-card)] border border-dashed border-[var(--ms-hairline)] bg-[var(--ms-card)] p-8 text-center">
                      <span className="ms-chip">{activeMeta.label}</span>
                      <p className="ms-body mx-auto mt-3 max-w-md">{activeMeta.empty}</p>
                    </div>
                  )}

                  {activeLaneFiles.map((file) => (
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
              </div>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-[calc(var(--ms-header-height)+18px)]">
              {selectedFileType === activeLaneSummary.type && selectedInActiveLane.length > 0 ? (
                <div className="space-y-4">
                  {selectedFileType === 'image' && (
                    <section className="ms-panel overflow-hidden bg-[var(--ms-card)] p-4">
                      <span className="ms-chip ms-chip-accent">Bilder</span>
                      <h2 className="ms-h4 mt-2">Freistellen.</h2>
                      <button
                        type="button"
                        className="ms-button-swap mt-4 inline-flex w-full items-center justify-center gap-2 text-sm font-medium"
                        onClick={handleEnableBackgroundRemovalForSelectedImages}
                        aria-label="Hintergrund für Auswahl aktivieren"
                      >
                        <ConvertPlayIcon className="h-4 w-4" />
                        <span data-label-stack>
                          <span data-default-label>Hintergrund aktivieren</span>
                          <span data-hover-label aria-hidden="true">{selectedImageFiles.length} Bild{selectedImageFiles.length !== 1 ? 'er' : ''}</span>
                        </span>
                      </button>
                    </section>
                  )}
                  <SelectionPanel
                    open
                    selectedCount={selectedInActiveLane.length}
                    selectedType={activeLaneSummary.type}
                    onApply={handleBulkApply}
                    onClose={handleClearSelection}
                    onAIRenameAll={activeLaneSummary.type === 'pdf' ? undefined : handleAIRenameSelected}
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
                </div>
              ) : (
                <section className="ms-panel overflow-hidden" aria-label="Export">
                  <div className="border-b border-[var(--ms-hairline)] p-5">
                    <span className="ms-chip ms-chip-accent">Export</span>
                    <h2 className="ms-h4 mt-2">Resultat.</h2>
                  </div>

                  <div className="grid grid-cols-2 border-b border-[var(--ms-hairline)]">
                    <div className="border-r border-[var(--ms-hairline)] p-4">
                      <span className="block text-3xl font-semibold">{pendingCount}</span>
                      <span className="ms-note">Offen</span>
                    </div>
                    <div className="p-4">
                      <span className="block text-3xl font-semibold">{completedCount}</span>
                      <span className="ms-note">Fertig</span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {pendingImageFiles.length > 0 && (
                      <div
                        className="rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3"
                        aria-label="Fotos kleiner machen"
                      >
                        <p className="text-xs font-medium text-[var(--ms-ink-muted)]">Fotos</p>
                        <h3 className="mt-1 text-sm font-medium">Für E-Mail kleiner machen</h3>
                        <button
                          type="button"
                          className="ms-button-swap mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-medium"
                          onClick={handleMakeImagesEmailReady}
                          aria-label={`Fotos für E-Mail kleiner machen (${pendingImageFiles.length})`}
                        >
                          <ConvertPlayIcon className="h-4 w-4" />
                          <span data-label-stack>
                            <span data-default-label>Fotos kleiner speichern</span>
                            <span data-hover-label aria-hidden="true">{pendingImageFiles.length} Bild{pendingImageFiles.length !== 1 ? 'er' : ''}</span>
                          </span>
                        </button>
                        <p className="ms-note mt-3">
                          Original bleibt unverändert. Danach erscheint der Download.
                        </p>
                      </div>
                    )}

                    {(pendingImageFiles.length > 0 || pendingPdfFiles.length > 1) && (
                      <div
                        className="rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-card)] p-3"
                        aria-label="Dokumentstapel"
                      >
                        <p className="text-xs font-medium text-[var(--ms-ink-muted)]">Dokumentstapel</p>
                        <h3 className="mt-1 text-sm font-medium">Handout oder Vertrag erstellen</h3>
                        <div className="mt-3 grid gap-2">
                          {pendingPdfFiles.length > 1 && (
                            <button
                              type="button"
                              className="ms-secondary-button inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-medium"
                              onClick={handleMergeAllPendingPdfs}
                            >
                              <BatchFilesIcon className="h-4 w-4" />
                              PDFs zu einer Datei machen
                            </button>
                          )}
                          {pendingImageFiles.length > 0 && (
                            <button
                              type="button"
                              className="ms-secondary-button inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-medium"
                              onClick={handleCreatePdfFromAllImages}
                            >
                              <BatchFilesIcon className="h-4 w-4" />
                              Bilder als PDF speichern
                            </button>
                          )}
                          {pendingImageFiles.length > 0 && (
                            <button
                              type="button"
                              className="ms-secondary-button inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-medium"
                              onClick={handleCreateSearchablePdfFromAllImages}
                            >
                              <BatchFilesIcon className="h-4 w-4" />
                              Text in PDF suchbar machen
                            </button>
                          )}
                        </div>
                        <p className="ms-note mt-3">
                          Nimmt die aktuelle Reihenfolge. Den Exportnamen können Sie danach ändern.
                        </p>
                      </div>
                    )}

                    {pendingCount > 0 && (
                      <div
                        className="rounded-[var(--ms-radius-card-small)] border border-[var(--ms-hairline)] bg-[var(--ms-cream)] p-3"
                        aria-label="Batch-Zusammenfassung"
                      >
                        <p className="text-xs font-medium text-[var(--ms-ink-muted)]">Wird gestartet</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {laneSummaries
                            .filter((lane) => lane.pending.length > 0)
                            .map((lane) => {
                              const meta = laneMeta[lane.type];

                              return (
                                <span key={lane.type} className="ms-chip">
                                  {lane.pending.length} {meta.label}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {pendingCount > 0 && (
                      <button
                        type="button"
                        className="ms-button-swap inline-flex w-full items-center justify-center gap-2 text-sm font-medium"
                        onClick={handleConvertAll}
                        aria-label={`Alle ${pendingCount} starten`}
                      >
                        <ConvertPlayIcon className="h-4 w-4" />
                        <span data-label-stack>
                          <span data-default-label>Alle {pendingCount} starten</span>
                          <span data-hover-label aria-hidden="true">Lokal exportieren</span>
                        </span>
                      </button>
                    )}

                    {hasCompletedFiles && (
                      <DownloadDropdown files={files} onDownloadIndividual={handleDownloadAll} />
                    )}

                    {hasFiles && (
                      <button
                        type="button"
                        className="ms-secondary-button inline-flex w-full items-center justify-center px-4 text-sm font-medium text-destructive"
                        onClick={handleClearAll}
                      >
                        Alle entfernen
                      </button>
                    )}

                    {!hasFiles && (
                      <p className="ms-note">
                        Sobald eine Datei fertig ist, erscheint hier der Download.
                      </p>
                    )}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>

      <footer className="bg-[var(--ms-stage)] py-6 text-[var(--ms-on-stage-muted)]">
        <div className="ms-rail flex flex-col items-center justify-between gap-3 text-xs sm:flex-row">
          <img src="/assets/logo-full-white.svg" alt="Maibach Systems" className="h-10 w-auto opacity-90" width="360" height="112" />
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
