import { describe, expect, it } from "vitest";
import { createLocalRemovalPlan } from "@/lib/localRemovalPlan";

describe("createLocalRemovalPlan", () => {
  it("treats static corner watermarks as local cleanup, not guaranteed removal", () => {
    const plan = createLocalRemovalPlan({
      deviceTier: "mid",
      height: 600,
      target: "static-corner-watermark",
      width: 800,
    });

    expect(plan).toMatchObject({
      capability: "degraded",
      localProcessingOnly: true,
      preservesOriginal: true,
      requiresAuthorization: true,
      target: "static-corner-watermark",
      tier: "local-inpaint",
      uiLabel: "Logo oder Textstelle bereinigen",
    });
    expect(plan.limitations.join(" ")).toMatch(/keine Garantie/i);
  });

  it("does not claim support for moving logos", () => {
    const plan = createLocalRemovalPlan({
      deviceTier: "high",
      height: 720,
      target: "moving-logo",
      width: 1280,
    });

    expect(plan).toMatchObject({
      capability: "unsupported",
      expectedOutcome: "fail",
      tier: "manual-export",
    });
    expect(plan.disabledReason).toMatch(/bewegte Logos/i);
  });

  it("keeps background removal local and marks low-end devices as degraded", () => {
    const plan = createLocalRemovalPlan({
      deviceTier: "low",
      height: 1200,
      target: "background",
      width: 1600,
    });

    expect(plan).toMatchObject({
      capability: "degraded",
      expectedOutcome: "degraded",
      localProcessingOnly: true,
      preservesOriginal: true,
      requiresAuthorization: true,
      tier: "background-model",
      uiLabel: "Hintergrund lokal entfernen",
    });
    expect(plan.limitations.join(" ")).toMatch(/langsam/i);
  });
});
