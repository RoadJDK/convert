import { describe, expect, it } from "vitest";

import {
  buildRenameCandidate,
  buildRenamePlan,
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

  it("uses multi-signal evidence to avoid generic animal captions", () => {
    const plan = buildRenamePlan({
      signals: [
        { type: "caption", value: "a large fish in blue water", confidence: 0.54 },
        { type: "object", value: "humpback whale", confidence: 0.91 },
        { type: "class-label", value: "whale", confidence: 0.86 },
      ],
      originalName: "fish-large-water.jpg",
      fileType: "image",
    });

    expect(plan.name).toBe("humpback-whale");
    expect(plan.confidence).toBeGreaterThanOrEqual(0.8);
    expect(plan.fallback).toBe(false);
  });

  it("scores caption signals through the Rename v2 signal interface", () => {
    const plan = buildRenamePlan({
      signals: [
        {
          type: "caption",
          value: "a golden retriever running on a beach with water in the background",
          confidence: 0.7,
        },
      ],
      originalName: "IMG_1234.JPG",
      fileType: "image",
    });

    expect(plan.name).toBe("beach-golden-retriever");
    expect(plan.fallback).toBe(false);
  });

  it.each([
    {
      label: "owl image",
      fileType: "image" as const,
      expected: "barn-owl",
      signals: [
        { type: "caption" as const, value: "a brown bird on a wooden branch", confidence: 0.51 },
        { type: "object" as const, value: "barn owl", confidence: 0.9 },
        { type: "class-label" as const, value: "owl", confidence: 0.84 },
      ],
    },
    {
      label: "crocodile image",
      fileType: "image" as const,
      expected: "american-crocodile",
      signals: [
        { type: "caption" as const, value: "a green lizard near water", confidence: 0.56 },
        { type: "object" as const, value: "american crocodile", confidence: 0.88 },
      ],
    },
    {
      label: "settings screenshot",
      fileType: "image" as const,
      expected: "settings-export-panel",
      signals: [
        { type: "caption" as const, value: "a screenshot of a computer window", confidence: 0.62 },
        { type: "ocr" as const, value: "Settings Export Panel", confidence: 0.82 },
      ],
    },
    {
      label: "invoice document",
      fileType: "image" as const,
      expected: "uberweisung-rechnung-2026",
      signals: [
        { type: "caption" as const, value: "a document on a white table", confidence: 0.57 },
        { type: "ocr" as const, value: "Überweisung Rechnung 2026", confidence: 0.92 },
      ],
    },
    {
      label: "product photo",
      fileType: "image" as const,
      expected: "espresso-grinder",
      signals: [
        { type: "caption" as const, value: "a black product on a counter", confidence: 0.55 },
        { type: "object" as const, value: "espresso grinder", confidence: 0.87 },
      ],
    },
    {
      label: "portrait photo",
      fileType: "image" as const,
      expected: "portrait-glasses",
      signals: [
        { type: "caption" as const, value: "a portrait photo of a person", confidence: 0.53 },
        { type: "object" as const, value: "portrait glasses", confidence: 0.8 },
      ],
    },
    {
      label: "short video",
      fileType: "video" as const,
      expected: "skateboard-kickflip",
      signals: [
        { type: "caption" as const, value: "a person doing a trick outside", confidence: 0.56 },
        { type: "object" as const, value: "skateboard kickflip", confidence: 0.85 },
      ],
    },
  ])("builds a specific local rename for $label", ({ fileType, expected, signals }) => {
    const plan = buildRenamePlan({
      signals,
      originalName: "IMG_0001.JPG",
      fileType,
    });

    expect(plan.name).toBe(expected);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.78);
    expect(plan.fallback).toBe(false);
  });
});
