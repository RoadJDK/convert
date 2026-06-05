import { describe, expect, it } from "vitest";
import { getAspectRatioString, formatTime, scalePixelCrop } from "@/lib/cropMath";

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

  it("scales rendered crop pixels back to source pixels", () => {
    expect(
      scalePixelCrop(
        { x: 10, y: 20, width: 100, height: 50 },
        { width: 400, height: 200 },
        { width: 1600, height: 800 },
      ),
    ).toEqual({
      x: 40,
      y: 80,
      width: 400,
      height: 200,
    });
  });
});
