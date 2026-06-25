import { useId } from "react";
import type { PixelCrop } from "react-image-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAspectRatioString, type Size } from "@/lib/cropMath";
import { LinkRatioIcon, ResetFrameIcon, UnlinkRatioIcon } from "@/components/icons/MediaConvertIcons";

interface ResizeControlsProps {
  aspectHeight: number;
  aspectLocked: boolean;
  aspectWidth: number;
  completedCrop?: PixelCrop;
  cropAspectLocked: boolean;
  dimensions: Size;
  originalDimensions: Size;
  onAspectHeightChange: (value: string) => void;
  onAspectWidthChange: (value: string) => void;
  onDimensionChange: (key: "width" | "height", value: string) => void;
  onResetDimensions: () => void;
  onToggleAspectLock: () => void;
  onToggleCropAspect: () => void;
}

export const ResizeControls = ({
  aspectHeight,
  aspectLocked,
  aspectWidth,
  completedCrop,
  cropAspectLocked,
  dimensions,
  originalDimensions,
  onAspectHeightChange,
  onAspectWidthChange,
  onDimensionChange,
  onResetDimensions,
  onToggleAspectLock,
  onToggleCropAspect,
}: ResizeControlsProps) => {
  const widthInputId = useId();
  const heightInputId = useId();
  const aspectWidthInputId = useId();
  const aspectHeightInputId = useId();

  return (
    <div className="h-fit space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Zielgrösse</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetDimensions}
          className="h-9 gap-1 text-xs"
        >
          <ResetFrameIcon className="h-3 w-3" />
          Zurücksetzen
        </Button>
      </div>

      <div className="space-y-2 border-y border-[var(--ms-hairline)] py-3">
        <Label className="text-sm">Grösse (px)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={widthInputId} className="text-xs">Breite</Label>
            <Input
              id={widthInputId}
              type="number"
              value={dimensions.width || ""}
              onChange={(event) => onDimensionChange("width", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={heightInputId} className="text-xs">Höhe</Label>
            <Input
              id={heightInputId}
              type="number"
              value={dimensions.height || ""}
              onChange={(event) => onDimensionChange("height", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-b border-[var(--ms-hairline)] pb-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Seitenverhältnis</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleAspectLock}
            className={aspectLocked ? "h-9 w-9 p-0 text-primary" : "h-9 w-9 p-0 text-muted-foreground"}
            title={aspectLocked ? "Verhältnis gelinkt" : "Verhältnis frei"}
          >
            {aspectLocked ? <LinkRatioIcon className="h-3 w-3" /> : <UnlinkRatioIcon className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={aspectWidthInputId}
            aria-label="Seitenverhältnis Breite"
            type="number"
            value={aspectWidth || ""}
            onChange={(event) => onAspectWidthChange(event.target.value)}
            placeholder="16"
            className="h-9 w-16 text-center text-sm"
            min={1}
          />
          <span className="font-medium text-muted-foreground">:</span>
          <Input
            id={aspectHeightInputId}
            aria-label="Seitenverhältnis Höhe"
            type="number"
            value={aspectHeight || ""}
            onChange={(event) => onAspectHeightChange(event.target.value)}
            placeholder="9"
            className="h-9 w-16 text-center text-sm"
            min={1}
          />
          <span className="ml-2 text-xs text-muted-foreground">
            Original: {getAspectRatioString(originalDimensions.width, originalDimensions.height)}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-b border-[var(--ms-hairline)] pb-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Ausschnitt an Ziel-Verhältnis</Label>
          <Button
            variant={cropAspectLocked ? "default" : "outline"}
            size="sm"
            onClick={onToggleCropAspect}
          >
            {cropAspectLocked ? "An" : "Aus"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Original: {originalDimensions.width} × {originalDimensions.height} px
      </p>

      {completedCrop && (
        <p className="text-xs text-muted-foreground">
          Aktueller Ausschnitt: {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
        </p>
      )}
    </div>
  );
};
