import {
  detectFileType,
  getOutputExtensionForFormat,
  getOutputMimeTypeForFormat,
  IMAGE_OUTPUT_OPTIONS,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_VIDEO_MIME_TYPES,
  VIDEO_OUTPUT_OPTIONS,
} from '@/lib/formatCapabilities';

export type FileType = 'image' | 'video';

export type ConversionStatus = 'pending' | 'converting' | 'completed' | 'error';

export type QualityMode = 'percentage' | 'maxSize';

export type ImageOutputFormat = 'webp' | 'jpeg' | 'png' | 'gif' | 'bmp' | 'avif' | 'svg';
export type VideoOutputFormat = 'webm' | 'mp4';
export type OutputFormat = ImageOutputFormat | VideoOutputFormat;
export type VideoRotation = 0 | 90 | 180 | 270;

export interface QualitySettings {
  mode: QualityMode;
  percentage: number; // 50-200 (displayed as 100-400%, internally 50% = 100% displayed)
  maxSizeKB: number; // in KB
  scale: number; // 10-200 (percentage of original size)
  outputFormat?: OutputFormat; // Target format
}

export interface CropArea {
  /**
   * Normalized source coordinates in the browser-decoded media orientation.
   * Values are fractions in the 0..1 range, resolved to natural pixels only
   * immediately before rendering or encoding.
   */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CleanupMaskPoint {
  x: number;
  y: number;
}

export interface CleanupMaskStroke {
  points: CleanupMaskPoint[];
  /**
   * Normalized brush radius relative to the smaller source-image dimension.
   */
  brushRadius: number;
}

export interface CleanupMask {
  strokes: CleanupMaskStroke[];
}

export interface TrimRange {
  start: number; // in seconds
  end: number; // in seconds
}

export interface ConvertibleFile {
  id: string;
  file: File;
  type: FileType;
  status: ConversionStatus;
  progress: number;
  originalName: string;
  suggestedName?: string;
  convertedBlob?: Blob;
  convertedUrl?: string;
  error?: string;
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  cleanupArea?: CropArea;
  cleanupMask?: CleanupMask;
  dimensions?: { width: number; height: number };
  originalSize: number;
  convertedSize?: number;
  // Video-specific
  trimRange?: TrimRange;
  videoRotation?: VideoRotation;
  videoDuration?: number;
  // Image-specific
  removeBackground?: boolean; // Toggle for background removal during conversion
  removeWatermark?: boolean; // Toggle for local/manual watermark cleanup during conversion
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  mode: 'percentage',
  percentage: 100, // Displayed as 100%, internally maps to ~0.57 quality
  maxSizeKB: 500,
  scale: 100,
  outputFormat: 'webp', // Default output format for images
};

export const DEFAULT_VIDEO_QUALITY_SETTINGS: QualitySettings = {
  mode: 'percentage',
  percentage: 100,
  maxSizeKB: 5000,
  scale: 100,
  outputFormat: 'webm', // Default output format for videos
};

export const SUPPORTED_IMAGE_FORMATS = SUPPORTED_IMAGE_MIME_TYPES;
export const SUPPORTED_VIDEO_FORMATS = SUPPORTED_VIDEO_MIME_TYPES;

export const getFileType = (file: File): FileType | null => {
  return detectFileType(file);
};

export const getOutputExtension = (type: FileType, format?: OutputFormat): string => {
  return getOutputExtensionForFormat(type, format);
};

export const getOutputMimeType = (type: FileType, format?: OutputFormat): string => {
  return getOutputMimeTypeForFormat(type, format);
};

export const IMAGE_OUTPUT_FORMATS = IMAGE_OUTPUT_OPTIONS;
export const VIDEO_OUTPUT_FORMATS = VIDEO_OUTPUT_OPTIONS;

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const calculateSizeChange = (original: number, converted: number): { percentage: number; isSmaller: boolean } => {
  const percentage = ((original - converted) / original) * 100;
  return { percentage: Math.abs(percentage), isSmaller: converted < original };
};

// Convert displayed percentage (50-200) to internal quality (0.4-0.92)
// This maps to actual canvas.toBlob quality parameter
export const displayedToInternalQuality = (displayed: number): number => {
  // 50% displayed = 0.4 (low quality, small file)
  // 100% displayed = 0.75 (good balance)
  // 200% displayed = 0.92 (near-lossless, capped to prevent bloat)
  // Linear interpolation: quality = 0.4 + (displayed - 50) * (0.92 - 0.4) / (200 - 50)
  const quality = 0.4 + ((displayed - 50) / 150) * 0.52;
  return Math.min(0.92, Math.max(0.4, quality));
};

// Convert internal quality (0.4-0.92) to displayed percentage (50-200)
export const internalToDisplayedQuality = (internal: number): number => {
  // Inverse of above
  const displayed = 50 + ((internal - 0.4) / 0.52) * 150;
  return Math.round(Math.min(200, Math.max(50, displayed)));
};
