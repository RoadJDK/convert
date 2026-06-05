import { describe, expect, it } from "vitest";

import { estimateConvertedFileSize } from "@/lib/sizeEstimation";

describe("estimateConvertedFileSize", () => {
  const sourceSize = 95 * 1024;
  const sourceFormat = "image/jpeg";

  function estimate(outputFormat: string, percentage: number, scale = 100) {
    return estimateConvertedFileSize({
      originalSize: sourceSize,
      originalFormat: sourceFormat,
      outputFormat,
      percentage,
      scale,
      fileType: "image",
    });
  }

  function expectReasonableEstimate(estimated: number, actual: number) {
    const ratio = estimated / actual;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(5);
  }

  it("keeps JPEG to WebP estimates close to real backtest data", () => {
    expectReasonableEstimate(estimate("webp", 50), 23 * 1024);
    expectReasonableEstimate(estimate("webp", 100), 45 * 1024);
    expectReasonableEstimate(estimate("webp", 200), 95 * 1024);
    expectReasonableEstimate(estimate("webp", 200, 200), 206 * 1024);
  });

  it("keeps JPEG to JPEG estimates close to real backtest data", () => {
    expectReasonableEstimate(estimate("jpeg", 50), 69 * 1024);
    expectReasonableEstimate(estimate("jpeg", 100), 153 * 1024);
    expectReasonableEstimate(estimate("jpeg", 200), 238 * 1024);
    expect(estimate("jpeg", 200, 200)).toBeGreaterThan(300 * 1024);
  });

  it("keeps JPEG to PNG estimates inside the known safe range", () => {
    expect(estimate("png", 50)).toBeLessThan(1024 * 1024);
    expect(estimate("png", 100)).toBeLessThan(2 * 1024 * 1024);
    expectReasonableEstimate(estimate("png", 200), 2.5 * 1024 * 1024);
  });

  it("accounts for lossless source formats when estimating lossy output", () => {
    const pngToWebp = estimateConvertedFileSize({
      originalSize: 500 * 1024,
      originalFormat: "image/png",
      outputFormat: "webp",
      percentage: 100,
      scale: 100,
      fileType: "image",
    });

    expect(pngToWebp).toBeLessThan(100 * 1024);
  });

  it("uses simpler format multipliers for videos", () => {
    const webm = estimateConvertedFileSize({
      originalSize: 10 * 1024 * 1024,
      originalFormat: "video/mp4",
      outputFormat: "webm",
      percentage: 100,
      scale: 100,
      fileType: "video",
    });
    const mp4 = estimateConvertedFileSize({
      originalSize: 10 * 1024 * 1024,
      originalFormat: "video/webm",
      outputFormat: "mp4",
      percentage: 100,
      scale: 100,
      fileType: "video",
    });

    expect(webm).toBeLessThan(mp4);
  });
});
