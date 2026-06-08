import { createEncodingCanvas, type EncodingCanvas } from "@/lib/imageEncoding";
import { createLocalRemovalPlan, type LocalRemovalPlan } from "@/lib/localRemovalPlan";
import type { CropArea } from "@/types/converter";
import { resolveCropAreaToSourcePixels } from "@/lib/cropMath";

export interface ImageSize {
  width: number;
  height: number;
}

export interface PixelRect extends ImageSize {
  x: number;
  y: number;
}

export interface WatermarkCleanupRegion extends PixelRect {
  source: PixelRect;
}

export interface WatermarkCleanupPlan {
  regions: WatermarkCleanupRegion[];
  blurRadius: number;
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

  const verticalShift = Math.max(regionHeight, Math.round(size.height * 0.2));
  const sourceY = clamp(target.y - verticalShift, 0, Math.max(0, size.height - regionHeight));

  return {
    ...target,
    source: {
      x: target.x,
      y: sourceY,
      width: target.width,
      height: target.height,
    },
  };
};

const createManualRegion = (size: ImageSize, manualArea: CropArea): WatermarkCleanupRegion => {
  const target = resolveCropAreaToSourcePixels(manualArea, size);
  const verticalShift = Math.max(target.height, Math.round(size.height * 0.16));
  const shiftedUpY = target.y - verticalShift;
  const shiftedDownY = target.y + verticalShift;
  const sourceY = shiftedUpY >= 0
    ? shiftedUpY
    : clamp(shiftedDownY, 0, Math.max(0, size.height - target.height));

  return {
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    source: {
      x: target.x,
      y: sourceY,
      width: target.width,
      height: target.height,
    },
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
    blurRadius: clamp(Math.round(Math.min(safeWidth, safeHeight) * 0.012), 2, 10),
    removal: createLocalRemovalPlan({
      target: "static-corner-watermark",
      width: safeWidth,
      height: safeHeight,
    }),
    regions,
  };
};

export const applyWatermarkCleanup = (canvas: EncodingCanvas, manualArea?: CropArea): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const { canvas: snapshot, context: snapshotCtx } = createEncodingCanvas(canvas.width, canvas.height);
  snapshotCtx.drawImage(canvas, 0, 0);

  const plan = createWatermarkCleanupPlan(
    {
      width: canvas.width,
      height: canvas.height,
    },
    manualArea,
  );

  for (const region of plan.regions) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(region.x, region.y, region.width, region.height, 4);
    } else {
      ctx.rect(region.x, region.y, region.width, region.height);
    }
    ctx.clip();

    ctx.filter = `blur(${plan.blurRadius}px)`;
    ctx.drawImage(
      snapshot,
      region.source.x,
      region.source.y,
      region.source.width,
      region.source.height,
      region.x,
      region.y,
      region.width,
      region.height,
    );

    ctx.filter = "none";
    ctx.globalAlpha = 0.18;
    ctx.drawImage(
      snapshot,
      region.source.x,
      region.source.y,
      region.source.width,
      region.source.height,
      region.x,
      region.y,
      region.width,
      region.height,
    );

    ctx.restore();
  }
};
