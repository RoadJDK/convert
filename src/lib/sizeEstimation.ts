import type { CropArea, FileType } from "@/types/converter";
import { resolveCropAreaToSourcePixels } from "@/lib/cropMath";

type FormatCompressionInfo = {
  baseMultiplier: number;
  lowQualityMultiplier: number;
  highQualityMultiplier: number;
  isLossless: boolean;
};

type EstimateConvertedFileSizeOptions = {
  originalSize: number;
  originalFormat?: string;
  outputFormat: string;
  percentage: number;
  originalDimensions?: { width: number; height: number };
  cropArea?: CropArea;
  scale: number;
  fileType: FileType;
};

const FORMAT_COMPRESSION_MULTIPLIERS: Record<string, FormatCompressionInfo> = {
  webp: {
    baseMultiplier: 0.5,
    lowQualityMultiplier: 0.25,
    highQualityMultiplier: 1.0,
    isLossless: false,
  },
  jpeg: {
    baseMultiplier: 1.6,
    lowQualityMultiplier: 0.75,
    highQualityMultiplier: 2.5,
    isLossless: false,
  },
  png: {
    baseMultiplier: 10.0,
    lowQualityMultiplier: 2.5,
    highQualityMultiplier: 40,
    isLossless: true,
  },
  avif: {
    baseMultiplier: 0.35,
    lowQualityMultiplier: 0.15,
    highQualityMultiplier: 1.5,
    isLossless: false,
  },
  gif: {
    baseMultiplier: 4.0,
    lowQualityMultiplier: 4.0,
    highQualityMultiplier: 16,
    isLossless: true,
  },
  bmp: {
    baseMultiplier: 30,
    lowQualityMultiplier: 7.5,
    highQualityMultiplier: 120,
    isLossless: true,
  },
  svg: {
    baseMultiplier: 1.0,
    lowQualityMultiplier: 0.75,
    highQualityMultiplier: 2.0,
    isLossless: true,
  },
};

export function estimateConvertedFileSize({
  originalSize,
  originalFormat,
  outputFormat,
  percentage,
  originalDimensions,
  cropArea,
  scale,
  fileType,
}: EstimateConvertedFileSizeOptions): number {
  if (fileType === "video") {
    const qualityFactor = percentage / 100;
    const formatMultiplier = outputFormat === "webm" ? 0.7 : 0.85;
    return Math.round(originalSize * formatMultiplier * (0.3 + qualityFactor * 0.35));
  }

  const formatInfo = FORMAT_COMPRESSION_MULTIPLIERS[outputFormat.toLowerCase()] ?? FORMAT_COMPRESSION_MULTIPLIERS.webp;
  const pixelRatio = getPixelRatio(originalDimensions, cropArea, scale);
  const qualityMultiplier = getQualityMultiplier(formatInfo, percentage);

  let estimatedSize = formatInfo.isLossless
    ? originalSize * qualityMultiplier
    : originalSize * qualityMultiplier * Math.sqrt(pixelRatio);

  if (isLosslessSource(originalFormat) && !formatInfo.isLossless) {
    estimatedSize *= 0.15;
  }

  return Math.max(1024, Math.round(estimatedSize));
}

function getPixelRatio(
  originalDimensions: { width: number; height: number } | undefined,
  cropArea: CropArea | undefined,
  scale: number,
): number {
  const scaleFactor = scale / 100;

  if (!originalDimensions) {
    return scaleFactor ** 2;
  }

  const originalPixels = originalDimensions.width * originalDimensions.height;
  const cropPixels = resolveCropAreaToSourcePixels(cropArea, originalDimensions);
  const croppedWidth = cropPixels.width;
  const croppedHeight = cropPixels.height;
  const outputPixels = croppedWidth * scaleFactor * croppedHeight * scaleFactor;

  return outputPixels / originalPixels;
}

function getQualityMultiplier(formatInfo: FormatCompressionInfo, percentage: number): number {
  if (percentage <= 100) {
    const t = (percentage - 50) / 50;
    return formatInfo.lowQualityMultiplier + t * (formatInfo.baseMultiplier - formatInfo.lowQualityMultiplier);
  }

  const t = (percentage - 100) / 100;
  return formatInfo.baseMultiplier + t * (formatInfo.highQualityMultiplier - formatInfo.baseMultiplier);
}

function isLosslessSource(originalFormat: string | undefined): boolean {
  const sourceFormat = originalFormat?.toLowerCase() || "";
  return (
    sourceFormat.includes("png") ||
    sourceFormat.includes("bmp") ||
    sourceFormat.includes("tiff") ||
    sourceFormat.includes("gif")
  );
}
