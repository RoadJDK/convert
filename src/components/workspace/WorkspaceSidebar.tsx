import { Button } from "@/components/ui/button";
import { DownloadDropdown } from "@/components/DownloadDropdown";
import { Stats } from "@/components/Stats";
import type { ConvertibleFile } from "@/types/converter";
import { ConvertPlayIcon, RemoveFileIcon } from "@/components/icons/MediaConvertIcons";

type WorkspaceSidebarProps = {
  completedCount: number;
  files: ConvertibleFile[];
  pendingCount: number;
  onClearAll: () => void;
  onConvertAll: () => void;
  onDownloadAll: () => void;
};

export function WorkspaceSidebar({
  completedCount,
  files,
  pendingCount,
  onClearAll,
  onConvertAll,
  onDownloadAll,
}: WorkspaceSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <Stats files={files} />

      <div className="glass-panel rounded-xl p-4">
        <p className="mono-kicker">aktionen</p>
        <div className="mt-4 space-y-2">
          {pendingCount > 0 && (
            <Button size="sm" onClick={onConvertAll} className="w-full justify-start gap-2">
              <ConvertPlayIcon className="h-4 w-4" />
              Alle starten ({pendingCount})
            </Button>
          )}
          {completedCount > 0 && <DownloadDropdown files={files} onDownloadIndividual={onDownloadAll} />}
          {files.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClearAll}
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            >
              <RemoveFileIcon className="h-4 w-4" />
              Alle löschen
            </Button>
          )}
          {files.length === 0 && (
            <p className="text-sm leading-6 text-muted-foreground">
              Sobald Dateien geladen sind, erscheinen Start, ZIP-Download und Bulk-Aktionen hier.
            </p>
          )}
        </div>
      </div>

    </aside>
  );
}
