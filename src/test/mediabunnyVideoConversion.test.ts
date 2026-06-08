import { describe, expect, it } from "vitest";

import {
  createMediabunnyConversionConfig,
  createMediabunnyOutputPlan,
} from "@/lib/mediabunnyVideoConversion";

describe("mediabunny video conversion adapter", () => {
  it("maps app output formats to Mediabunny-compatible codecs and MIME types", () => {
    expect(createMediabunnyOutputPlan("webm")).toEqual({
      targetMime: "video/webm",
      videoCodec: "vp8",
    });

    expect(createMediabunnyOutputPlan("mp4")).toEqual({
      targetMime: "video/mp4",
      videoCodec: "avc",
    });
  });

  it("resolves normalized crop, trim and scale into Mediabunny conversion options", () => {
    const config = createMediabunnyConversionConfig({
      outputFormat: "webm",
      videoWidth: 64,
      videoHeight: 64,
      duration: 1.2,
      cropArea: { x: 0.25, y: 0.125, width: 0.5, height: 0.75 },
      scale: 50,
      trimRange: { start: 0.2, end: 0.9 },
    });

    expect(config).toEqual({
      targetMime: "video/webm",
      trim: { start: 0.2, end: 0.9 },
      video: {
        codec: "vp8",
        crop: { left: 16, top: 8, width: 32, height: 48 },
        fit: "fill",
        forceTranscode: true,
        height: 24,
        width: 16,
      },
    });
  });

  it("keeps target dimensions even when resize settings produce odd values", () => {
    const config = createMediabunnyConversionConfig({
      outputFormat: "mp4",
      videoWidth: 128,
      videoHeight: 72,
      duration: 2,
      dimensions: { width: 33, height: 27 },
      scale: 150,
    });

    expect(config).toMatchObject({
      targetMime: "video/mp4",
      video: {
        codec: "avc",
        fit: "fill",
        forceTranscode: true,
        width: 50,
        height: 42,
      },
    });
  });

  it("bakes requested right-angle rotation into the output frames", () => {
    const config = createMediabunnyConversionConfig({
      outputFormat: "webm",
      videoWidth: 80,
      videoHeight: 48,
      duration: 1,
      videoRotation: 90,
    });

    expect(config).toMatchObject({
      video: {
        allowRotationMetadata: false,
        forceTranscode: true,
        height: 80,
        rotate: 90,
        width: 48,
      },
    });
  });
});
