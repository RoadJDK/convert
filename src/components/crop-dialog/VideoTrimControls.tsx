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
    <div className="space-y-2 rounded-lg border bg-card p-2 sm:p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Video schneiden</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 gap-1 text-xs"
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
          className="h-7 w-7 p-0"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseFrameIcon className="h-4 w-4" /> : <ConvertPlayIcon className="h-4 w-4" />}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between font-mono text-xs text-muted-foreground">
          <span className="text-green-600">{formatTime(trimStart)}</span>
          <span>{formatTime(currentTime)}</span>
          <span className="text-red-600">{formatTime(trimEnd)}</span>
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
            <SliderPrimitive.Track className="relative h-6 w-full grow overflow-hidden rounded-md bg-muted">
              <div
                className="absolute h-full bg-primary/20"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                }}
              />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="block h-5 w-1 cursor-ew-resize rounded-full bg-primary shadow-lg ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <SliderPrimitive.Track className="pointer-events-none relative h-6 w-full grow overflow-hidden rounded-md">
              <SliderPrimitive.Range className="pointer-events-none absolute h-full" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              className="pointer-events-auto block h-8 w-3 cursor-ew-resize rounded-sm border-2 border-green-500 bg-green-500 shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Start"
            />
            <SliderPrimitive.Thumb
              className="pointer-events-auto block h-8 w-3 cursor-ew-resize rounded-sm border-2 border-red-500 bg-red-500 shadow-md ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Ende"
            />
          </SliderPrimitive.Root>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Dauer: {formatTime(Math.max(0, trimEnd - trimStart))}
      </p>
    </div>
  );
};
