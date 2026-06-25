import type { EncodingCanvas } from "@/lib/imageEncoding";
import { createRectangularInpaintingMask, createStrokeInpaintingMask, inpaintMaskedPixels } from "@/lib/localInpainting";
import { createLocalRemovalPlan, type LocalRemovalPlan } from "@/lib/localRemovalPlan";
import type { CleanupMask, CropArea } from "@/types/converter";
import { resolveCropAreaToSourcePixels } from "@/lib/cropMath";

export interface ImageSize {
  width: number;
  height: number;
}

export interface PixelRect extends ImageSize {
  x: number;
  y: number;
}

export type WatermarkCleanupRegion = PixelRect;

export interface WatermarkCleanupPlan {
  regions: WatermarkCleanupRegion[];
  repairMethod: "local-diffusion-inpaint";
  removal: LocalRemovalPlan;
}

const MIN_REGION_WIDTH = 32;
const MIN_REGION_HEIGHT = 24;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const createRegion = (
  side: "left" | "right",
  size: ImageSize,
  regionWidth: number,
  regionHeight: number,
  marginX: number,
  marginY: number,
): WatermarkCleanupRegion => {
  const maxX = Math.max(0, size.width - regionWidth);
  const x = side === "left" ? marginX : size.width - regionWidth - marginX;
  const y = size.height - regionHeight - marginY;
  const target: PixelRect = {
    x: clamp(Math.round(x), 0, maxX),
    y: clamp(Math.round(y), 0, Math.max(0, size.height - regionHeight)),
    width: regionWidth,
    height: regionHeight,
  };

  return target;
};

const createManualRegion = (size: ImageSize, manualArea: CropArea): WatermarkCleanupRegion => {
  const target = resolveCropAreaToSourcePixels(manualArea, size);
  const paddingX = Math.max(12, Math.round(target.width * 0.35));
  const paddingY = Math.max(12, Math.round(target.height * 0.35));
  const left = clamp(target.x - paddingX, 0, Math.max(0, size.width - 1));
  const top = clamp(target.y - paddingY, 0, Math.max(0, size.height - 1));
  const right = clamp(target.x + target.width + paddingX, left + 1, size.width);
  const bottom = clamp(target.y + target.height + paddingY, top + 1, size.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

export const createWatermarkCleanupPlan = (size: ImageSize, manualArea?: CropArea): WatermarkCleanupPlan => {
  const safeWidth = Math.max(1, Math.round(size.width));
  const safeHeight = Math.max(1, Math.round(size.height));
  const regionWidth = Math.min(
    safeWidth,
    Math.max(MIN_REGION_WIDTH, Math.round(safeWidth * 0.26)),
  );
  const regionHeight = Math.min(
    safeHeight,
    Math.max(MIN_REGION_HEIGHT, Math.round(safeHeight * 0.16)),
  );
  const marginX = Math.round(safeWidth * 0.04);
  const marginY = Math.round(safeHeight * 0.08);

  const regions = manualArea
    ? [createManualRegion({ width: safeWidth, height: safeHeight }, manualArea)]
    : [
        createRegion("left", { width: safeWidth, height: safeHeight }, regionWidth, regionHeight, marginX, marginY),
        createRegion("right", { width: safeWidth, height: safeHeight }, regionWidth, regionHeight, marginX, marginY),
      ];

  return {
    repairMethod: "local-diffusion-inpaint",
    removal: createLocalRemovalPlan({
      target: "static-corner-watermark",
      width: safeWidth,
      height: safeHeight,
    }),
    regions,
  };
};

export const applyWatermarkCleanup = (canvas: EncodingCanvas, manualArea?: CropArea, cleanupMask?: CleanupMask): void => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const plan = createWatermarkCleanupPlan(
    {
      width: canvas.width,
      height: canvas.height,
    },
    manualArea,
  );
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = cleanupMask && cleanupMask.strokes.length > 0
    ? createStrokeInpaintingMask({ width: canvas.width, height: canvas.height }, cleanupMask.strokes)
    : createRectangularInpaintingMask({ width: canvas.width, height: canvas.height }, plan.regions);
  const result = inpaintMaskedPixels(imageData, mask);

  imageData.data.set(result.image.data);
  ctx.putImageData(imageData, 0, 0);
};
