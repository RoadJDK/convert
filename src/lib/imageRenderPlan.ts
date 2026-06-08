import type { CropArea } from "@/types/converter";
import { resolveCropAreaToSourcePixels } from "@/lib/cropMath";

type ResolveImageRenderPlanOptions = {
  sourceWidth: number;
  sourceHeight: number;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  scale?: number;
};

export type ImageRenderPlan = {
  source: { x: number; y: number; width: number; height: number };
  target: { width: number; height: number };
  orientationBoundary: "browser-decoded";
};

export function resolveImageRenderPlan(options: ResolveImageRenderPlanOptions): ImageRenderPlan {
  const sourceWidth = Math.max(1, Math.round(options.sourceWidth));
  const sourceHeight = Math.max(1, Math.round(options.sourceHeight));
  const source = resolveCropAreaToSourcePixels(options.cropArea, {
    width: sourceWidth,
    height: sourceHeight,
  });
  const scale = clamp((options.scale ?? 100) / 100, 0.01, 4);
  const baseWidth = options.dimensions?.width ?? source.width;
  const baseHeight = options.dimensions?.height ?? source.height;

  return {
    source,
    target: {
      width: Math.max(1, Math.round(baseWidth * scale)),
      height: Math.max(1, Math.round(baseHeight * scale)),
    },
    orientationBoundary: "browser-decoded",
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
