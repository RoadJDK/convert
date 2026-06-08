import type { CropArea, TrimRange, VideoOutputFormat, VideoRotation } from "@/types/converter";
import { resolveCropAreaToSourcePixels } from "@/lib/cropMath";

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
  videoRotation?: VideoRotation;
};

type ResolveRenderedVideoCleanupAreaOptions = {
  cleanupArea?: CropArea;
  renderPlan: VideoRenderPlan;
  sourceSize: { width: number; height: number };
};

export type VideoRenderPlan = {
  rotation: VideoRotation;
  source: { x: number; y: number; width: number; height: number };
  target: { width: number; height: number };
  trim: { start: number; end: number; safeStart: number; duration: number };
};

type CreateVideoConversionStrategyOptions = {
  webCodecsSupported: boolean;
  mediabunnySupported: boolean;
  hasCrop: boolean;
  hasDimensions: boolean;
  hasRotation: boolean;
  hasTrim: boolean;
  hasWatermarkCleanup?: boolean;
};

export type VideoConversionStrategy = {
  engine: "webcodecs" | "mediabunny" | "mediarecorder";
  degraded: boolean;
  reason:
    | "webcodecs-supported-edit"
    | "webcodecs-supported-remux"
    | "mediabunny-supported-edit"
    | "crop-trim-requires-frame-edit-muxer"
    | "watermark-cleanup-requires-frame-render"
    | "webcodecs-unavailable";
};

type CreateWebCodecsResizeOperationOptions = {
  dimensions?: { width: number; height: number };
  scale?: number;
};

export type WebCodecsResizeOperation =
  | { mode: "max-height-width"; maxHeight: number; maxWidth: number }
  | { mode: "scale"; scale: number };

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

export function createVideoConversionStrategy({
  webCodecsSupported,
  mediabunnySupported,
  hasCrop,
  hasDimensions,
  hasRotation,
  hasTrim,
  hasWatermarkCleanup = false,
}: CreateVideoConversionStrategyOptions): VideoConversionStrategy {
  if (hasWatermarkCleanup) {
    return {
      engine: "mediarecorder",
      degraded: true,
      reason: "watermark-cleanup-requires-frame-render",
    };
  }

  if (hasCrop || hasRotation || hasTrim) {
    if (mediabunnySupported) {
      return {
        engine: "mediabunny",
        degraded: false,
        reason: "mediabunny-supported-edit",
      };
    }

    return {
      engine: "mediarecorder",
      degraded: true,
      reason: "crop-trim-requires-frame-edit-muxer",
    };
  }

  if (!webCodecsSupported) {
    return {
      engine: "mediarecorder",
      degraded: true,
      reason: "webcodecs-unavailable",
    };
  }

  return {
    engine: "webcodecs",
    degraded: false,
    reason: hasDimensions ? "webcodecs-supported-edit" : "webcodecs-supported-remux",
  };
}

export function createWebCodecsResizeOperation({
  dimensions,
  scale = 100,
}: CreateWebCodecsResizeOperationOptions): WebCodecsResizeOperation | null {
  const scaleFactor = clamp(scale / 100, 0.01, 4);

  if (dimensions) {
    return {
      mode: "max-height-width",
      maxWidth: toEvenDimension(dimensions.width * scaleFactor),
      maxHeight: toEvenDimension(dimensions.height * scaleFactor),
    };
  }

  if (Math.abs(scaleFactor - 1) > 0.001) {
    return {
      mode: "scale",
      scale: scaleFactor,
    };
  }

  return null;
}

export function resolveVideoRenderPlan(options: ResolveVideoRenderPlanOptions): VideoRenderPlan {
  const videoWidth = Math.max(2, Math.round(options.videoWidth));
  const videoHeight = Math.max(2, Math.round(options.videoHeight));
  const duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : 0;

  const crop = resolveCropAreaToSourcePixels(options.cropArea, {
    width: videoWidth,
    height: videoHeight,
  });
  const x = clamp(crop.x, 0, videoWidth - 2);
  const y = clamp(crop.y, 0, videoHeight - 2);
  const width = clamp(crop.width, 2, videoWidth - x);
  const height = clamp(crop.height, 2, videoHeight - y);

  const scale = clamp((options.scale ?? 100) / 100, 0.01, 4);
  const baseWidth = options.dimensions?.width ?? width;
  const baseHeight = options.dimensions?.height ?? height;
  const rotation = options.videoRotation ?? 0;
  const swapsAxes = rotation === 90 || rotation === 270;
  const targetWidth = toEvenDimension((swapsAxes && !options.dimensions ? baseHeight : baseWidth) * scale);
  const targetHeight = toEvenDimension((swapsAxes && !options.dimensions ? baseWidth : baseHeight) * scale);

  const start = clamp(options.trimRange?.start ?? 0, 0, duration);
  const requestedEnd = options.trimRange?.end ?? duration;
  const end = requestedEnd > start ? clamp(requestedEnd, start, duration) : duration;
  const safeStart = duration > 0 ? Math.min(start, Math.max(0, duration - 0.05)) : 0;

  return {
    rotation,
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

export function resolveRenderedVideoCleanupArea(
  options: ResolveRenderedVideoCleanupAreaOptions,
): CropArea | undefined {
  if (!options.cleanupArea) return undefined;

  const sourceWidth = Math.max(1, Math.round(options.sourceSize.width));
  const sourceHeight = Math.max(1, Math.round(options.sourceSize.height));
  const cleanup = resolveCropAreaToSourcePixels(options.cleanupArea, {
    width: sourceWidth,
    height: sourceHeight,
  });
  const source = options.renderPlan.source;
  const left = clamp(cleanup.x, source.x, source.x + source.width);
  const top = clamp(cleanup.y, source.y, source.y + source.height);
  const right = clamp(cleanup.x + cleanup.width, left, source.x + source.width);
  const bottom = clamp(cleanup.y + cleanup.height, top, source.y + source.height);

  if (right <= left || bottom <= top) return undefined;

  const normalized: CropArea = {
    x: normalizeFraction((left - source.x) / source.width),
    y: normalizeFraction((top - source.y) / source.height),
    width: normalizeFraction((right - left) / source.width),
    height: normalizeFraction((bottom - top) / source.height),
  };

  if (options.renderPlan.rotation === 90) {
    return {
      x: normalizeFraction(1 - (normalized.y + normalized.height)),
      y: normalized.x,
      width: normalized.height,
      height: normalized.width,
    };
  }

  if (options.renderPlan.rotation === 180) {
    return {
      x: normalizeFraction(1 - (normalized.x + normalized.width)),
      y: normalizeFraction(1 - (normalized.y + normalized.height)),
      width: normalized.width,
      height: normalized.height,
    };
  }

  if (options.renderPlan.rotation === 270) {
    return {
      x: normalized.y,
      y: normalizeFraction(1 - (normalized.x + normalized.width)),
      width: normalized.height,
      height: normalized.width,
    };
  }

  return normalized;
}

function toEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeFraction(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(6));
}
