import type { CropArea } from "@/types/converter";
import type { CleanupMask } from "@/types/converter";
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

type ResolveRenderedCleanupAreaOptions = {
  cleanupArea?: CropArea;
  renderSource: ImageRenderPlan["source"];
  sourceSize: { width: number; height: number };
};

type ResolveRenderedCleanupMaskOptions = {
  cleanupMask?: CleanupMask;
  renderSource: ImageRenderPlan["source"];
  sourceSize: { width: number; height: number };
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

function normalizeFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}

export function resolveRenderedCleanupArea(options: ResolveRenderedCleanupAreaOptions): CropArea | undefined {
  if (!options.cleanupArea) return undefined;

  const cleanup = resolveCropAreaToSourcePixels(options.cleanupArea, options.sourceSize);
  const source = options.renderSource;
  const left = Math.max(cleanup.x, source.x);
  const top = Math.max(cleanup.y, source.y);
  const right = Math.min(cleanup.x + cleanup.width, source.x + source.width);
  const bottom = Math.min(cleanup.y + cleanup.height, source.y + source.height);

  if (right <= left || bottom <= top) {
    return undefined;
  }

  return {
    x: normalizeFraction((left - source.x) / source.width),
    y: normalizeFraction((top - source.y) / source.height),
    width: normalizeFraction((right - left) / source.width),
    height: normalizeFraction((bottom - top) / source.height),
  };
}

export function resolveRenderedCleanupMask(options: ResolveRenderedCleanupMaskOptions): CleanupMask | undefined {
  if (!options.cleanupMask || options.cleanupMask.strokes.length === 0) return undefined;

  const sourceWidth = Math.max(1, Math.round(options.sourceSize.width));
  const sourceHeight = Math.max(1, Math.round(options.sourceSize.height));
  const source = options.renderSource;
  const sourceBrushBase = Math.min(sourceWidth, sourceHeight);
  const renderBrushBase = Math.min(source.width, source.height);
  const strokes = options.cleanupMask.strokes
    .map((stroke) => {
      const points = stroke.points
        .map((point) => {
          const sourceX = point.x * sourceWidth;
          const sourceY = point.y * sourceHeight;

          if (
            sourceX < source.x ||
            sourceY < source.y ||
            sourceX > source.x + source.width ||
            sourceY > source.y + source.height
          ) {
            return undefined;
          }

          return {
            x: normalizeFraction((sourceX - source.x) / source.width),
            y: normalizeFraction((sourceY - source.y) / source.height),
          };
        })
        .filter((point): point is { x: number; y: number } => Boolean(point));

      if (points.length === 0) return undefined;

      return {
        brushRadius: normalizeFraction((stroke.brushRadius * sourceBrushBase) / renderBrushBase),
        points,
      };
    })
    .filter((stroke): stroke is CleanupMask["strokes"][number] => Boolean(stroke));

  return strokes.length > 0 ? { strokes } : undefined;
}
