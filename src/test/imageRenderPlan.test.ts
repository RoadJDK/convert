import { describe, expect, it } from "vitest";

import { resolveImageRenderPlan, resolveRenderedCleanupArea, resolveRenderedCleanupMask } from "@/lib/imageRenderPlan";

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

  it("maps a source cleanup area into the rendered crop canvas", () => {
    const renderPlan = resolveImageRenderPlan({
      sourceWidth: 1000,
      sourceHeight: 500,
      cropArea: { x: 0.25, y: 0, width: 0.5, height: 1 },
    });

    expect(resolveRenderedCleanupArea({
      cleanupArea: { x: 0.35, y: 0.2, width: 0.2, height: 0.3 },
      renderSource: renderPlan.source,
      sourceSize: { width: 1000, height: 500 },
    })).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.3,
    });
  });

  it("maps normalized freehand cleanup strokes into the rendered crop canvas", () => {
    const renderPlan = resolveImageRenderPlan({
      sourceWidth: 1000,
      sourceHeight: 500,
      cropArea: { x: 0.25, y: 0, width: 0.5, height: 1 },
    });

    expect(resolveRenderedCleanupMask({
      cleanupMask: {
        strokes: [{
          brushRadius: 0.04,
          points: [
            { x: 0.35, y: 0.2 },
            { x: 0.55, y: 0.4 },
            { x: 0.9, y: 0.4 },
          ],
        }],
      },
      renderSource: renderPlan.source,
      sourceSize: { width: 1000, height: 500 },
    })).toEqual({
      strokes: [{
        brushRadius: 0.04,
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.6, y: 0.4 },
        ],
      }],
    });
  });
});
