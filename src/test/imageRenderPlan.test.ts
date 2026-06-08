import { describe, expect, it } from "vitest";

import { resolveImageRenderPlan } from "@/lib/imageRenderPlan";

describe("image render plan", () => {
  it("resolves normalized source crops to decoded image pixels and scaled target dimensions", () => {
    expect(
      resolveImageRenderPlan({
        sourceWidth: 1600,
        sourceHeight: 800,
        cropArea: { x: 0.025, y: 0.1, width: 0.25, height: 0.25 },
        scale: 50,
      }),
    ).toEqual({
      source: { x: 40, y: 80, width: 400, height: 200 },
      target: { width: 200, height: 100 },
      orientationBoundary: "browser-decoded",
    });
  });

  it("uses explicit target dimensions before applying user scale", () => {
    expect(
      resolveImageRenderPlan({
        sourceWidth: 1200,
        sourceHeight: 1800,
        cropArea: { x: 0.25, y: 0, width: 0.5, height: 1 },
        dimensions: { width: 300, height: 450 },
        scale: 200,
      }),
    ).toEqual({
      source: { x: 300, y: 0, width: 600, height: 1800 },
      target: { width: 600, height: 900 },
      orientationBoundary: "browser-decoded",
    });
  });
});
