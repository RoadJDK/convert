export type FileType = 'image' | 'video';

export type ConversionStatus = 'pending' | 'converting' | 'completed' | 'error';

export type QualityMode = 'percentage' | 'maxSize';

export type ImageOutputFormat = 'webp' | 'jpeg' | 'png' | 'gif' | 'bmp' | 'avif';
export type VideoOutputFormat = 'webm' | 'mp4' | 'gif';
export type OutputFormat = ImageOutputFormat | VideoOutputFormat;

export interface QualitySettings {
  mode: QualityMode;
  percentage: number; // 50-200 (displayed as 100-400%, internally 50% = 100% displayed)
  maxSizeKB: number; // in KB
  scale: number; // 10-200 (percentage of original size)
  outputFormat?: OutputFormat; // Target format
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
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
  originalSize: number;
  convertedSize?: number;
  // Video-specific
  trimRange?: TrimRange;
  videoDuration?: number;
  // Image-specific
  removeBackground?: boolean; // Toggle for background removal during conversion
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  mode: 'percentage',
  percentage: 100, // Displayed as 100%, internally maps to 50% quality
  maxSizeKB: 500,
  scale: 100,
};

export const SUPPORTED_IMAGE_FORMATS = [
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/heic',
  'image/heif',
];

export const SUPPORTED_VIDEO_FORMATS = [
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/ogg',
  'video/3gpp',
  'video/x-flv',
  'video/x-ms-wmv',
];

export const getFileType = (file: File): FileType | null => {
  if (SUPPORTED_IMAGE_FORMATS.includes(file.type)) return 'image';
  if (SUPPORTED_VIDEO_FORMATS.includes(file.type)) return 'video';
  return null;
};

export const getOutputExtension = (type: FileType, format?: OutputFormat): string => {
  if (format) {
    if (format === 'jpeg') return 'jpg';
    return format;
  }
  return type === 'image' ? 'webp' : 'webm';
};

export const getOutputMimeType = (type: FileType, format?: OutputFormat): string => {
  if (format) {
    const mimeMap: Record<OutputFormat, string> = {
      webp: 'image/webp',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      avif: 'image/avif',
      webm: 'video/webm',
      mp4: 'video/mp4',
    };
    return mimeMap[format];
  }
  return type === 'image' ? 'image/webp' : 'video/webm';
};

export const IMAGE_OUTPUT_FORMATS: { value: ImageOutputFormat; label: string }[] = [
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'avif', label: 'AVIF' },
  { value: 'gif', label: 'GIF' },
  { value: 'bmp', label: 'BMP' },
];

export const VIDEO_OUTPUT_FORMATS: { value: VideoOutputFormat; label: string }[] = [
  { value: 'webm', label: 'WebM' },
  { value: 'mp4', label: 'MP4' },
  { value: 'gif', label: 'GIF' },
];

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
