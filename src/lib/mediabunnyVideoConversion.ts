import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  type ConversionVideoOptions,
  type CropRectangle,
  type VideoCodec,
} from "mediabunny";

import type { CropArea, QualitySettings, TrimRange, VideoOutputFormat } from "@/types/converter";
import { resolveVideoRenderPlan } from "@/lib/videoConversionPlan";

type ConversionOptions = {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
};

type ConversionResult = { blob: Blob; url: string };

type MediabunnyTargetMime = "video/webm" | "video/mp4";
type MediabunnyVideoCodec = Extract<VideoCodec, "vp8" | "avc">;

type CreateMediabunnyConversionConfigOptions = {
  outputFormat: VideoOutputFormat;
  videoWidth: number;
  videoHeight: number;
  duration: number;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  scale?: number;
  trimRange?: TrimRange;
};

export type MediabunnyOutputPlan = {
  targetMime: MediabunnyTargetMime;
  videoCodec: MediabunnyVideoCodec;
};

export type MediabunnyConversionConfig = {
  targetMime: MediabunnyTargetMime;
  trim?: { start: number; end: number };
  video: ConversionVideoOptions;
};

export function createMediabunnyOutputPlan(outputFormat: VideoOutputFormat = "webm"): MediabunnyOutputPlan {
  if (outputFormat === "mp4") {
    return {
      targetMime: "video/mp4",
      videoCodec: "avc",
    };
  }

  return {
    targetMime: "video/webm",
    videoCodec: "vp8",
  };
}

export function createMediabunnyConversionConfig(
  options: CreateMediabunnyConversionConfigOptions,
): MediabunnyConversionConfig {
  const outputPlan = createMediabunnyOutputPlan(options.outputFormat);
  const renderPlan = resolveVideoRenderPlan({
    videoWidth: options.videoWidth,
    videoHeight: options.videoHeight,
    duration: options.duration,
    cropArea: options.cropArea,
    dimensions: options.dimensions,
    scale: options.scale,
    trimRange: options.trimRange,
  });
  const hasCrop = Boolean(options.cropArea);
  const hasResize =
    Boolean(options.dimensions) || Math.abs(((options.scale ?? 100) / 100) - 1) > 0.001;
  const crop = hasCrop
    ? {
        left: renderPlan.source.x,
        top: renderPlan.source.y,
        width: renderPlan.source.width,
        height: renderPlan.source.height,
      } satisfies CropRectangle
    : undefined;
  const trim =
    options.trimRange && options.duration > 0
      ? {
          start: renderPlan.trim.start,
          end: renderPlan.trim.end,
        }
      : undefined;

  return {
    targetMime: outputPlan.targetMime,
    trim,
    video: {
      codec: outputPlan.videoCodec,
      crop,
      fit: "fill",
      forceTranscode: hasCrop || hasResize,
      height: renderPlan.target.height,
      width: renderPlan.target.width,
    },
  };
}

export function isMediabunnyVideoConversionSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoDecoder !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

export async function convertWithMediabunny(
  file: File,
  onProgress: (progress: number) => void,
  options: ConversionOptions,
): Promise<ConversionResult> {
  onProgress(5);

  const outputFormat = (options.qualitySettings.outputFormat || "webm") as VideoOutputFormat;
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error("Video enthält keine nutzbare Videospur");
    }

    const [videoWidth, videoHeight, duration] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(),
    ]);
    const config = createMediabunnyConversionConfig({
      outputFormat,
      videoWidth,
      videoHeight,
      duration,
      cropArea: options.cropArea,
      dimensions: options.dimensions,
      scale: options.qualitySettings.scale,
      trimRange: options.trimRange,
    });
    const target = new BufferTarget();
    const output = new Output({
      format: createMediabunnyOutputFormat(outputFormat),
      target,
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim: config.trim,
      video: config.video,
      showWarnings: false,
    });

    const discardedMediaTracks = conversion.discardedTracks.filter(
      ({ track }) => track.type === "audio" || track.type === "video",
    );
    if (!conversion.isValid || discardedMediaTracks.length > 0) {
      throw new Error(`Mediabunny konnte die Spuren nicht konvertieren: ${describeDiscardedTracks(conversion)}`);
    }

    conversion.onProgress = (progress) => {
      onProgress(5 + progress * 90);
    };

    await conversion.execute();
    onProgress(95);

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("Video conversion produced empty file");
    }

    const blob = new Blob([buffer], { type: config.targetMime });
    if (!blob || blob.size === 0) {
      throw new Error("Video conversion produced empty file");
    }

    const url = URL.createObjectURL(blob);
    onProgress(100);
    return { blob, url };
  } finally {
    input.dispose();
  }
}

function createMediabunnyOutputFormat(outputFormat: VideoOutputFormat) {
  return outputFormat === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat();
}

function describeDiscardedTracks(conversion: Conversion): string {
  if (conversion.discardedTracks.length === 0) {
    return "unknown reason";
  }

  return conversion.discardedTracks
    .map((track) => `${track.track.type}:${track.reason}`)
    .join(", ");
}
