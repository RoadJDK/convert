import { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import type { CropArea } from "@/types/converter";

export interface Size {
  width: number;
  height: number;
}

export const centerAspectCrop = (mediaWidth: number, mediaHeight: number, aspect: number): Crop => {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
};

export const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const gcd = (a: number, b: number): number => {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
};

export const getAspectRatioString = (width: number, height: number): string => {
  if (width <= 0 || height <= 0) return "";
  const divisor = gcd(Math.round(width), Math.round(height));
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);

  if ((w === 16 && h === 9) || (w === 32 && h === 18)) return "16:9";
  if ((w === 9 && h === 16) || (w === 18 && h === 32)) return "9:16";
  if ((w === 4 && h === 3) || (w === 8 && h === 6)) return "4:3";
  if ((w === 3 && h === 4) || (w === 6 && h === 8)) return "3:4";
  if (w === h) return "1:1";
  if ((w === 21 && h === 9) || (w === 7 && h === 3)) return "21:9";
  return `${w}:${h}`;
};

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const normalizeFraction = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
};

export const normalizeRenderedPixelCrop = (
  crop: Pick<PixelCrop, "x" | "y" | "width" | "height">,
  rendered: Size,
): CropArea => {
  const renderedWidth = Math.max(1, rendered.width);
  const renderedHeight = Math.max(1, rendered.height);
  const left = clamp(crop.x / renderedWidth, 0, 1);
  const top = clamp(crop.y / renderedHeight, 0, 1);
  const right = clamp((crop.x + crop.width) / renderedWidth, left, 1);
  const bottom = clamp((crop.y + crop.height) / renderedHeight, top, 1);

  return {
    x: normalizeFraction(left),
    y: normalizeFraction(top),
    width: normalizeFraction(right - left),
    height: normalizeFraction(bottom - top),
  };
};

export const resolveCropAreaToSourcePixels = (cropArea: CropArea | undefined, source: Size): CropArea => {
  const sourceWidth = Math.max(1, Math.round(source.width));
  const sourceHeight = Math.max(1, Math.round(source.height));

  if (!cropArea) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  }

  const left = clamp(cropArea.x, 0, 1);
  const top = clamp(cropArea.y, 0, 1);
  const right = clamp(cropArea.x + cropArea.width, left, 1);
  const bottom = clamp(cropArea.y + cropArea.height, top, 1);

  const x = clamp(Math.round(left * sourceWidth), 0, sourceWidth - 1);
  const y = clamp(Math.round(top * sourceHeight), 0, sourceHeight - 1);
  const rightPx = clamp(Math.round(right * sourceWidth), x + 1, sourceWidth);
  const bottomPx = clamp(Math.round(bottom * sourceHeight), y + 1, sourceHeight);

  return {
    x,
    y,
    width: rightPx - x,
    height: bottomPx - y,
  };
};

export const scalePixelCrop = normalizeRenderedPixelCrop;
