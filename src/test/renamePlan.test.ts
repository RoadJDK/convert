import { describe, expect, it } from "vitest";

import {
  buildRenameCandidate,
  sanitizeFilenameBase,
  selectVideoFrameTimes,
} from "@/lib/renamePlan";

describe("rename plan", () => {
  it("turns noisy image captions into short descriptive filenames", () => {
    const name = buildRenameCandidate({
      captions: ["a golden retriever running on a beach with water in the background"],
      originalName: "IMG_1234.JPG",
      fileType: "image",
    });

    expect(name).toBe("beach-golden-retriever");
  });

  it("uses repeated video-frame subjects instead of original clip names", () => {
    const name = buildRenameCandidate({
      captions: [
        "a woman cooking pasta in a kitchen",
        "a pan with pasta in a kitchen",
        "a woman serving pasta",
      ],
      originalName: "VID_0099.MOV",
      fileType: "video",
    });

    expect(name).toBe("pasta-kitchen-woman");
  });

  it("falls back to the cleaned original name when captions are generic", () => {
    expect(
      buildRenameCandidate({
        captions: ["a picture of an image"],
        originalName: "Sommer Event 2026!!!.png",
        fileType: "image",
      }),
    ).toBe("sommer-event-2026");
  });

  it("sanitizes accents, punctuation, extensions and length", () => {
    expect(sanitizeFilenameBase("Über-grosser Kunden Workshop FINAL.mov")).toBe("uber-grosser-kunden");
  });

  it("samples representative local video frames", () => {
    expect(selectVideoFrameTimes(10)).toEqual([2, 5, 8]);
    expect(selectVideoFrameTimes(2)).toEqual([1]);
    expect(selectVideoFrameTimes(Number.NaN)).toEqual([0]);
  });
});
