import { Button } from "@/components/ui/button";
import type { VideoRotation } from "@/types/converter";
import { ResetFrameIcon, RotateLeftIcon, RotateRightIcon } from "@/components/icons/MediaConvertIcons";

interface VideoRotationControlsProps {
  rotation: VideoRotation;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onReset: () => void;
}

export const VideoRotationControls = ({
  rotation,
  onRotateLeft,
  onRotateRight,
  onReset,
}: VideoRotationControlsProps) => (
  <div className="mt-4 space-y-3 border-t border-[var(--ms-hairline)] pt-4">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Drehung</span>
      <span className="font-mono text-xs text-muted-foreground">{rotation}°</span>
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      Die Vorschau zeigt die Drehung vor dem Export.
    </p>

    <div className="grid grid-cols-3 gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRotateLeft}
        aria-label="Links drehen"
        title="Links drehen"
        className="h-9 px-0"
      >
        <RotateLeftIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReset}
        aria-label="Drehung zurücksetzen"
        title="Drehung zurücksetzen"
        className="h-9 px-0"
        disabled={rotation === 0}
      >
        <ResetFrameIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRotateRight}
        aria-label="Rechts drehen"
        title="Rechts drehen"
        className="h-9 px-0"
      >
        <RotateRightIcon className="h-4 w-4" />
      </Button>
    </div>
  </div>
);
