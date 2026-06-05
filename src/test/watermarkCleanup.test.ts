import { describe, expect, it } from "vitest";
import { createWatermarkCleanupPlan } from "@/lib/watermarkCleanup";

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

  it("copies replacement pixels from above each watermark region", () => {
    const plan = createWatermarkCleanupPlan({ width: 800, height: 600 });

    for (const item of plan.regions) {
      expect(item.source.y).toBeLessThan(item.y);
      expect(item.source.width).toBe(item.width);
      expect(item.source.height).toBe(item.height);
    }
  });
});
