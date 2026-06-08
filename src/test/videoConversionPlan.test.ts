import { describe, expect, it } from "vitest";

import {
  chooseMediaRecorderMimeType,
  createVideoEncodingPlan,
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
});
