import type { CropArea, TrimRange, VideoOutputFormat } from "@/types/converter";

type VideoContainer = "webm" | "mp4";
type VideoCodec = "vp8" | "h264";
type AudioCodec = "opus" | "aac";

export type VideoEncodingPlan = {
  container: VideoContainer;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  targetMime: "video/webm" | "video/mp4";
};

type ResolveVideoRenderPlanOptions = {
  videoWidth: number;
  videoHeight: number;
  duration: number;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  scale?: number;
  trimRange?: TrimRange;
};

export type VideoRenderPlan = {
  source: { x: number; y: number; width: number; height: number };
  target: { width: number; height: number };
  trim: { start: number; end: number; safeStart: number; duration: number };
};

export function createVideoEncodingPlan(outputFormat: VideoOutputFormat = "webm"): VideoEncodingPlan {
  if (outputFormat === "mp4") {
    return {
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      targetMime: "video/mp4",
    };
  }

  return {
    container: "webm",
    videoCodec: "vp8",
    audioCodec: "opus",
    targetMime: "video/webm",
  };
}

export function chooseMediaRecorderMimeType(
  outputFormat: VideoOutputFormat,
  isTypeSupported: (mimeType: string) => boolean = (mimeType) => MediaRecorder.isTypeSupported(mimeType),
): string | null {
  const candidates =
    outputFormat === "mp4"
      ? [
          "video/mp4;codecs=avc1",
          "video/mp4",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp8",
          "video/webm",
        ]
      : ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"];

  return candidates.find(isTypeSupported) ?? null;
}

export function resolveVideoRenderPlan(options: ResolveVideoRenderPlanOptions): VideoRenderPlan {
  const videoWidth = Math.max(2, Math.round(options.videoWidth));
  const videoHeight = Math.max(2, Math.round(options.videoHeight));
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0;

  const requestedX = options.cropArea?.x ?? 0;
  const requestedY = options.cropArea?.y ?? 0;
  const x = clamp(Math.round(requestedX), 0, videoWidth - 2);
  const y = clamp(Math.round(requestedY), 0, videoHeight - 2);
  const width = clamp(Math.round(options.cropArea?.width ?? videoWidth), 2, videoWidth - x);
  const height = clamp(Math.round(options.cropArea?.height ?? videoHeight), 2, videoHeight - y);

  const scale = clamp((options.scale ?? 100) / 100, 0.01, 4);
  const baseWidth = options.dimensions?.width ?? width;
  const baseHeight = options.dimensions?.height ?? height;
  const targetWidth = toEvenDimension(baseWidth * scale);
  const targetHeight = toEvenDimension(baseHeight * scale);

  const start = clamp(options.trimRange?.start ?? 0, 0, duration);
  const requestedEnd = options.trimRange?.end ?? duration;
  const end = requestedEnd > start ? clamp(requestedEnd, start, duration) : duration;
  const safeStart = duration > 0 ? Math.min(start, Math.max(0, duration - 0.05)) : 0;

  return {
    source: { x, y, width, height },
    target: { width: targetWidth, height: targetHeight },
    trim: {
      start,
      end,
      safeStart,
      duration: Math.max(0.1, end - start),
    },
  };
}

function toEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
