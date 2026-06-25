import { describe, expect, it } from "vitest";

import { applyConversionPreset, getConversionPresets } from "@/lib/conversionPresets";
import { DEFAULT_QUALITY_SETTINGS, DEFAULT_VIDEO_QUALITY_SETTINGS } from "@/types/converter";

describe("conversion presets", () => {
  it("returns local image presets with complete quality settings", () => {
    const [webSmall, jpegSmall, pngClean] = getConversionPresets("image");

    expect(webSmall).toMatchObject({
      id: "image-web-small",
      label: "E-Mail/Web",
      fileType: "image",
      settings: {
        mode: "percentage",
        outputFormat: "webp",
        percentage: 85,
        scale: 100,
      },
    });
    expect(jpegSmall.settings).toMatchObject({
      mode: "maxSize",
      maxSizeKB: 300,
      outputFormat: "jpeg",
    });
    expect(pngClean.settings.outputFormat).toBe("png");
  });

  it("returns video presets and excludes PDFs", () => {
    expect(getConversionPresets("video").map((preset) => preset.id)).toEqual([
      "video-web-small",
      "video-mp4-archive",
    ]);
    expect(getConversionPresets("pdf")).toEqual([]);
  });

  it("applies a preset over the current settings", () => {
    const [preset] = getConversionPresets("video");

    expect(applyConversionPreset(DEFAULT_VIDEO_QUALITY_SETTINGS, preset)).toEqual({
      mode: "percentage",
      percentage: 80,
      maxSizeKB: 5000,
      scale: 75,
      outputFormat: "webm",
    });

    const jpegPreset = getConversionPresets("image")[1];
    expect(applyConversionPreset(DEFAULT_QUALITY_SETTINGS, jpegPreset).outputFormat).toBe("jpeg");
  });
});
