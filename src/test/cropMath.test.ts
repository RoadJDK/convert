import { describe, expect, it } from "vitest";
import {
  formatTime,
  getAspectRatioString,
  normalizeRenderedPixelCrop,
  resolveCropAreaToSourcePixels,
} from "@/lib/cropMath";

describe("cropMath", () => {
  it("formats seconds as compact mm:ss labels", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7.9)).toBe("0:07");
    expect(formatTime(125.2)).toBe("2:05");
  });

  it("normalizes common aspect ratios", () => {
    expect(getAspectRatioString(1920, 1080)).toBe("16:9");
    expect(getAspectRatioString(1080, 1920)).toBe("9:16");
    expect(getAspectRatioString(1500, 1000)).toBe("3:2");
    expect(getAspectRatioString(0, 1000)).toBe("");
  });

  it("stores rendered crop pixels as normalized source coordinates", () => {
    expect(
      normalizeRenderedPixelCrop(
        { x: 10, y: 20, width: 100, height: 50 },
        { width: 400, height: 200 },
      ),
    ).toEqual({
      x: 0.025,
      y: 0.1,
      width: 0.25,
      height: 0.25,
    });
  });

  it("resolves normalized crops to exact decoded source pixels at encode time", () => {
    expect(
      resolveCropAreaToSourcePixels(
        { x: 0.025, y: 0.1, width: 0.25, height: 0.25 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({
      x: 40,
      y: 80,
      width: 400,
      height: 200,
    });
  });

  it("clamps rounded crop edges inside decoded image bounds", () => {
    expect(
      resolveCropAreaToSourcePixels(
        { x: 0.96, y: 0.9, width: 0.2, height: 0.3 },
        { width: 101, height: 51 },
      ),
    ).toEqual({
      x: 97,
      y: 46,
      width: 4,
      height: 5,
    });
  });

  it("defines the EXIF orientation boundary as browser-decoded natural dimensions", () => {
    expect(
      resolveCropAreaToSourcePixels(
        { x: 0.25, y: 0, width: 0.5, height: 1 },
        { width: 1200, height: 1800 },
      ),
    ).toEqual({
      x: 300,
      y: 0,
      width: 600,
      height: 1800,
    });
  });
});
