import { describe, expect, it } from "vitest";

import {
  chooseMediaRecorderMimeType,
  createVideoConversionStrategy,
  createVideoEncodingPlan,
  createWebCodecsResizeOperation,
  resolveRenderedVideoCleanupArea,
  resolveVideoRenderPlan,
} from "@/lib/videoConversionPlan";

describe("video conversion plan", () => {
  it("maps requested output formats to stable container and codec settings", () => {
    expect(createVideoEncodingPlan("webm")).toEqual({
      container: "webm",
      videoCodec: "vp8",
      audioCodec: "opus",
      targetMime: "video/webm",
    });

    expect(createVideoEncodingPlan("mp4")).toEqual({
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      targetMime: "video/mp4",
    });
  });

  it("chooses the best MediaRecorder MIME type for the requested output", () => {
    const supports = (mimeType: string) => ["video/mp4", "video/webm;codecs=vp8"].includes(mimeType);

    expect(chooseMediaRecorderMimeType("mp4", supports)).toBe("video/mp4");
    expect(chooseMediaRecorderMimeType("webm", supports)).toBe("video/webm;codecs=vp8");
  });

  it("falls back to WebM recording when MP4 recording is unavailable", () => {
    const supports = (mimeType: string) => mimeType === "video/webm;codecs=vp8,opus";

    expect(chooseMediaRecorderMimeType("mp4", supports)).toBe("video/webm;codecs=vp8,opus");
  });

  it("clamps crop, trim and target dimensions for reliable recording", () => {
    const plan = resolveVideoRenderPlan({
      videoWidth: 1280,
      videoHeight: 720,
      duration: 10,
      cropArea: { x: -0.02, y: 10 / 720, width: 2, height: 719 / 720 },
      dimensions: { width: 101, height: 99 },
      scale: 100,
      trimRange: { start: 9, end: 4 },
    });

    expect(plan.source).toEqual({ x: 0, y: 10, width: 1280, height: 710 });
    expect(plan.target).toEqual({ width: 102, height: 100 });
    expect(plan.trim).toEqual({ start: 9, end: 10, safeStart: 9, duration: 1 });
  });

  it("uses WebCodecs first for resize-only edits", () => {
    expect(
      createVideoConversionStrategy({
        webCodecsSupported: true,
        mediabunnySupported: true,
        hasCrop: false,
        hasDimensions: true,
        hasRotation: false,
        hasTrim: false,
      }),
    ).toEqual({
      engine: "webcodecs",
      degraded: false,
      reason: "webcodecs-supported-edit",
    });
  });

  it("uses Mediabunny for crop and trim edits when supported", () => {
    expect(
      createVideoConversionStrategy({
        webCodecsSupported: true,
        mediabunnySupported: true,
        hasCrop: true,
        hasDimensions: false,
        hasRotation: false,
        hasTrim: true,
      }),
    ).toEqual({
      engine: "mediabunny",
      degraded: false,
      reason: "mediabunny-supported-edit",
    });
  });

  it("uses Mediabunny for rotation edits when supported", () => {
    expect(
      createVideoConversionStrategy({
        webCodecsSupported: true,
        mediabunnySupported: true,
        hasCrop: false,
        hasDimensions: false,
        hasRotation: true,
        hasTrim: false,
        hasWatermarkCleanup: false,
      }),
    ).toEqual({
      engine: "mediabunny",
      degraded: false,
      reason: "mediabunny-supported-edit",
    });
  });

  it("uses a degraded frame-render path for video cleanup masks", () => {
    expect(
      createVideoConversionStrategy({
        webCodecsSupported: true,
        mediabunnySupported: true,
        hasCrop: false,
        hasDimensions: false,
        hasRotation: false,
        hasTrim: false,
        hasWatermarkCleanup: true,
      }),
    ).toEqual({
      engine: "mediarecorder",
      degraded: true,
      reason: "watermark-cleanup-requires-frame-render",
    });
  });

  it("maps source cleanup areas into the final rotated video frame", () => {
    const plan = resolveVideoRenderPlan({
      videoWidth: 100,
      videoHeight: 50,
      duration: 1,
      cropArea: { x: 0.25, y: 0, width: 0.5, height: 1 },
      videoRotation: 90,
    });

    expect(resolveRenderedVideoCleanupArea({
      cleanupArea: { x: 0.35, y: 0.2, width: 0.2, height: 0.3 },
      renderPlan: plan,
      sourceSize: { width: 100, height: 50 },
    })).toEqual({
      x: 0.5,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
  });

  it("uses MediaRecorder as an explicit unsupported-browser fallback", () => {
    expect(
      createVideoConversionStrategy({
        webCodecsSupported: false,
        mediabunnySupported: false,
        hasCrop: false,
        hasDimensions: true,
        hasRotation: false,
        hasTrim: false,
      }),
    ).toEqual({
      engine: "mediarecorder",
      degraded: true,
      reason: "webcodecs-unavailable",
    });
  });

  it("maps target dimensions and scale to a WebCodecs resize operation", () => {
    expect(createWebCodecsResizeOperation({ dimensions: { width: 101, height: 99 }, scale: 150 })).toEqual({
      mode: "max-height-width",
      maxWidth: 152,
      maxHeight: 150,
    });
  });

  it("swaps target dimensions for right-angle rotation when no explicit target size is set", () => {
    const plan = resolveVideoRenderPlan({
      videoWidth: 80,
      videoHeight: 48,
      duration: 1,
      videoRotation: 90,
    });

    expect(plan.rotation).toBe(90);
    expect(plan.target).toEqual({ width: 48, height: 80 });
  });

  it("maps scale-only edits to a WebCodecs scale operation", () => {
    expect(createWebCodecsResizeOperation({ scale: 50 })).toEqual({
      mode: "scale",
      scale: 0.5,
    });
    expect(createWebCodecsResizeOperation({ scale: 100 })).toBeNull();
  });
});
