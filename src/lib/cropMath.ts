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

export const scalePixelCrop = (
  crop: Pick<PixelCrop, "x" | "y" | "width" | "height">,
  rendered: Size,
  source: Size,
): CropArea => {
  const scaleX = source.width / rendered.width;
  const scaleY = source.height / rendered.height;

  return {
    x: Math.round(crop.x * scaleX),
    y: Math.round(crop.y * scaleY),
    width: Math.round(crop.width * scaleX),
    height: Math.round(crop.height * scaleY),
  };
};
