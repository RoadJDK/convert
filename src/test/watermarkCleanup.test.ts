import { describe, expect, it } from "vitest";
import { applyWatermarkCleanup, createWatermarkCleanupPlan } from "@/lib/watermarkCleanup";

describe("createWatermarkCleanupPlan", () => {
  it("targets both lower corners for moving social watermarks", () => {
    const plan = createWatermarkCleanupPlan({ width: 1000, height: 500 });

    expect(plan.regions).toHaveLength(2);
    expect(plan.regions[0]).toMatchObject({
      x: 40,
      y: 380,
      width: 260,
      height: 80,
    });
    expect(plan.regions[1]).toMatchObject({
      x: 700,
      y: 380,
      width: 260,
      height: 80,
    });
  });

  it("keeps cleanup regions inside tiny images", () => {
    const plan = createWatermarkCleanupPlan({ width: 120, height: 80 });

    expect(plan.regions).toHaveLength(2);
    for (const region of plan.regions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(120);
      expect(region.y + region.height).toBeLessThanOrEqual(80);
      expect(region.width).toBeGreaterThanOrEqual(32);
      expect(region.height).toBeGreaterThanOrEqual(24);
    }
  });

  it("uses local diffusion inpainting for masked regions", () => {
    const plan = createWatermarkCleanupPlan({ width: 800, height: 600 });

    expect(plan.repairMethod).toBe("local-diffusion-inpaint");
  });

  it("describes the cleanup as degraded local repair with original preservation", () => {
    const plan = createWatermarkCleanupPlan({ width: 800, height: 600 });

    expect(plan.removal).toMatchObject({
      capability: "degraded",
      localProcessingOnly: true,
      preservesOriginal: true,
      requiresAuthorization: true,
      tier: "local-inpaint",
      uiLabel: "Logo oder Textstelle bereinigen",
    });
  });

  it("pads a manually selected cleanup area for inpainting boundary context", () => {
    const plan = createWatermarkCleanupPlan(
      { width: 1000, height: 500 },
      { x: 0.2, y: 0.25, width: 0.3, height: 0.2 },
    );

    expect(plan.regions).toHaveLength(1);
    expect(plan.regions[0]).toMatchObject({
      x: 95,
      y: 90,
      width: 510,
      height: 170,
    });
    expect(plan.repairMethod).toBe("local-diffusion-inpaint");
  });

  it("expands tiny text-band selections enough to include surrounding watermark color", () => {
    const plan = createWatermarkCleanupPlan(
      { width: 96, height: 64 },
      { x: 68 / 96, y: 43 / 64, width: 16 / 96, height: 4 / 64 },
    );

    expect(plan.regions[0]).toMatchObject({
      x: 56,
      y: 31,
      width: 40,
      height: 28,
    });
  });
});

describe("applyWatermarkCleanup", () => {
  it("uses a freehand cleanup mask when strokes are provided", () => {
    const width = 96;
    const height = 64;
    const imageData = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        imageData.data[offset] = x < Math.floor(width / 2) ? 20 : 220;
        imageData.data[offset + 1] = y * 4;
        imageData.data[offset + 2] = 80;
        imageData.data[offset + 3] = 255;
      }
    }

    for (let y = 36; y < 58; y += 1) {
      for (let x = 60; x < 92; x += 1) {
        const offset = (y * width + x) * 4;
        imageData.data[offset] = 225;
        imageData.data[offset + 1] = 18;
        imageData.data[offset + 2] = 47;
      }
    }

    const context = {
      getImageData: () => imageData,
      putImageData: (updated: typeof imageData) => {
        imageData.data.set(updated.data);
      },
    };
    const canvas = {
      width,
      height,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;

    applyWatermarkCleanup(canvas, undefined, {
      strokes: [{
        brushRadius: 0.25,
        points: [
          { x: 0.62, y: 0.72 },
          { x: 0.95, y: 0.72 },
        ],
      }],
    });

    const offset = (46 * width + 72) * 4;
    const [red, green, blue] = imageData.data.slice(offset, offset + 3);

    expect(green).toBeGreaterThan(100);
    expect(blue).toBeGreaterThan(70);
    expect(red - green).toBeLessThan(120);
  });
});
