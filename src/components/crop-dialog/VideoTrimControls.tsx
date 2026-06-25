import * as SliderPrimitive from "@radix-ui/react-slider";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/cropMath";
import { ConvertPlayIcon, PauseFrameIcon, ResetFrameIcon } from "@/components/icons/MediaConvertIcons";

interface VideoTrimControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  trimEnd: number;
  trimStart: number;
  onPositionChange: (values: number[]) => void;
  onRangeChange: (values: number[]) => void;
  onReset: () => void;
  onTogglePlayback: () => void;
}

export const VideoTrimControls = ({
  currentTime,
  duration,
  isPlaying,
  trimEnd,
  trimStart,
  onPositionChange,
  onRangeChange,
  onReset,
  onTogglePlayback,
}: VideoTrimControlsProps) => {
  if (duration <= 0) return null;

  return (
    <div className="space-y-3 rounded-[var(--ms-radius-card)] bg-[var(--ms-on-stage-row)] p-3 text-[var(--ms-on-stage)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Video schneiden</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-9 gap-1 text-xs text-[var(--ms-on-stage-muted)] hover:bg-[var(--ms-on-stage-chip)] hover:text-[var(--ms-on-stage)]"
        >
          <ResetFrameIcon className="h-3 w-3" />
          Zurücksetzen
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePlayback}
          className="h-9 w-9 p-0 text-[var(--ms-on-stage)] hover:bg-[var(--ms-on-stage-chip)]"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseFrameIcon className="h-4 w-4" /> : <ConvertPlayIcon className="h-4 w-4" />}
        </Button>
        <span className="font-mono text-xs text-[var(--ms-on-stage-muted)]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-xs text-[var(--ms-on-stage-muted)]">
          <span>
            Start <span className="font-mono text-accent">{formatTime(trimStart)}</span>
          </span>
          <span className="text-center">
            Position <span className="font-mono">{formatTime(currentTime)}</span>
          </span>
          <span className="text-right">
            Ende <span className="font-mono text-[var(--ms-on-stage)]">{formatTime(trimEnd)}</span>
          </span>
        </div>

        <div className="relative h-8">
          <SliderPrimitive.Root
            value={[currentTime]}
            onValueChange={onPositionChange}
            min={0}
            max={duration}
            step={0.1}
            className="absolute inset-0 z-10 flex w-full touch-none select-none items-center"
          >
            <SliderPrimitive.Track className="relative h-6 w-full grow overflow-hidden rounded-[var(--ms-radius-chip)] bg-[var(--ms-on-stage-chip)]">
              <div
                className="absolute h-full bg-[var(--ms-accent-tint)]"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                }}
              />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="block h-5 w-1 cursor-ew-resize rounded-full bg-[var(--ms-on-stage)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Position"
            />
          </SliderPrimitive.Root>

          <SliderPrimitive.Root
            value={[trimStart, trimEnd]}
            onValueChange={onRangeChange}
            min={0}
            max={duration}
            step={0.1}
            minStepsBetweenThumbs={1}
            className="pointer-events-none absolute inset-0 z-20 flex w-full touch-none select-none items-center"
          >
            <SliderPrimitive.Track className="pointer-events-none relative h-6 w-full grow overflow-hidden rounded-[var(--ms-radius-chip)]">
              <SliderPrimitive.Range className="pointer-events-none absolute h-full" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="pointer-events-auto block h-8 w-3 cursor-ew-resize rounded-[var(--ms-radius-chip)] border-2 border-accent bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Start"
            />
            <SliderPrimitive.Thumb
              className="pointer-events-auto block h-8 w-3 cursor-ew-resize rounded-[var(--ms-radius-chip)] border-2 border-[var(--ms-on-stage)] bg-[var(--ms-on-stage)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ende"
            />
          </SliderPrimitive.Root>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--ms-on-stage-muted)]">
        Dauer: {formatTime(Math.max(0, trimEnd - trimStart))}
      </p>
    </div>
  );
};
