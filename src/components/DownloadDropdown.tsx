import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import JSZip from 'jszip';
import { ConvertibleFile, getOutputExtension } from '@/types/converter';
import {
  ArchiveBoxIcon,
  BatchFilesIcon,
  ChevronDownIcon,
  DownloadTrayIcon,
  LoaderRingIcon,
} from '@/components/icons/MediaConvertIcons';

interface DownloadDropdownProps {
  files: ConvertibleFile[];
  onDownloadIndividual: () => void;
}

export const DownloadDropdown = ({ files, onDownloadIndividual }: DownloadDropdownProps) => {
  const [isCreatingZip, setIsCreatingZip] = useState(false);

  const completedFiles = files.filter(f => f.status === 'completed' && f.convertedBlob);
  const count = completedFiles.length;

  const handleDownloadZip = async () => {
    if (completedFiles.length === 0) return;

    setIsCreatingZip(true);
    try {
      const zip = new JSZip();

      completedFiles.forEach((file) => {
        if (file.convertedBlob) {
          const extension = getOutputExtension(file.type, file.qualitySettings.outputFormat);
          const baseName = file.suggestedName || file.originalName.replace(/\.[^/.]+$/, '');
          const fileName = `${baseName}.${extension}`;
          zip.file(fileName, file.convertedBlob);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `maibach-convert-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP:', error);
    } finally {
      setIsCreatingZip(false);
    }
  };

  if (count === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          size="sm" 
          className="gap-2 bg-success text-success-foreground hover:bg-success/90"
          disabled={isCreatingZip}
        >
          {isCreatingZip ? (
            <LoaderRingIcon className="h-4 w-4 animate-spin" />
          ) : (
            <DownloadTrayIcon className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Alle downloaden</span>
          <span className="sm:hidden">Download</span>
          ({count})
          <ChevronDownIcon className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDownloadIndividual} className="gap-2 cursor-pointer">
          <BatchFilesIcon className="h-4 w-4" />
          <span>Einzeln ({count} Dateien)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadZip} disabled={isCreatingZip} className="gap-2 cursor-pointer">
          <ArchiveBoxIcon className="h-4 w-4" />
          <span>Als ZIP-Archiv</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
