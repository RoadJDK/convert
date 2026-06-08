import type { DeviceTier } from "@/lib/localProcessingEngine";

export type LocalRemovalTarget = "background" | "static-corner-watermark" | "moving-logo";
export type LocalRemovalTier = "background-model" | "mask-cleanup" | "smart-crop" | "manual-export";
export type LocalRemovalCapability = "ready" | "degraded" | "unsupported";
export type LocalRemovalExpectedOutcome = "pass" | "degraded" | "fail";

export interface LocalRemovalPlanInput {
  target: LocalRemovalTarget;
  width: number;
  height: number;
  deviceTier?: DeviceTier;
}

export interface LocalRemovalPlan {
  target: LocalRemovalTarget;
  tier: LocalRemovalTier;
  capability: LocalRemovalCapability;
  expectedOutcome: LocalRemovalExpectedOutcome;
  localProcessingOnly: true;
  preservesOriginal: true;
  requiresAuthorization: true;
  uiLabel: string;
  uiDescription: string;
  limitations: string[];
  disabledReason?: string;
}

const basePlan = (
  input: Pick<
    LocalRemovalPlan,
    | "target"
    | "tier"
    | "capability"
    | "expectedOutcome"
    | "uiLabel"
    | "uiDescription"
    | "limitations"
    | "disabledReason"
  >,
): LocalRemovalPlan => ({
  ...input,
  localProcessingOnly: true,
  preservesOriginal: true,
  requiresAuthorization: true,
});

export function createLocalRemovalPlan(input: LocalRemovalPlanInput): LocalRemovalPlan {
  const deviceTier = input.deviceTier ?? "mid";

  if (input.target === "background") {
    const degraded = deviceTier === "low" || input.width * input.height > 8_000_000;

    return basePlan({
      target: input.target,
      tier: "background-model",
      capability: degraded ? "degraded" : "ready",
      expectedOutcome: degraded ? "degraded" : "pass",
      uiLabel: "Hintergrund lokal entfernen",
      uiDescription: "Die Datei bleibt im Browser, das Original bleibt unverändert.",
      limitations: degraded
        ? ["Kann auf Low-End-Geräten langsam sein.", "Kanten und Haare können sichtbar ungenau bleiben."]
        : ["Kanten und Haare können sichtbar ungenau bleiben."],
    });
  }

  if (input.target === "moving-logo") {
    return basePlan({
      target: input.target,
      tier: "manual-export",
      capability: "unsupported",
      expectedOutcome: "fail",
      uiLabel: "Bewegtes Logo nicht automatisch entfernen",
      uiDescription: "Bewegte Logos brauchen eine manuelle Maske oder einen späteren Inpainting-Pfad.",
      limitations: ["Bewegte Logos werden nicht als automatische Entfernung versprochen."],
      disabledReason: "Bewegte Logos sind in diesem lokalen Slice nicht zuverlässig entfernbar.",
    });
  }

  const lowResolution = Math.min(input.width, input.height) < 160;

  return basePlan({
    target: input.target,
    tier: lowResolution ? "smart-crop" : "mask-cleanup",
    capability: "degraded",
    expectedOutcome: "degraded",
    uiLabel: "Watermark bereinigen",
    uiDescription: "Lokale Ecken-Bereinigung, keine echte Inpainting-Garantie.",
    limitations: [
      "Keine Garantie für vollständige Entfernung.",
      lowResolution
        ? "Sehr kleine Bilder werden nur grob bereinigt."
        : "Die aktuelle Maske kopiert und glättet passende Hintergrundpixel.",
    ],
  });
}
