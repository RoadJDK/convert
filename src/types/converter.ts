export type FileType = 'image' | 'video';

export type ConversionStatus = 'pending' | 'converting' | 'completed' | 'error';

export type QualityMode = 'percentage' | 'maxSize';

export interface QualitySettings {
  mode: QualityMode;
  percentage: number; // 1-100
  maxSizeKB: number; // in KB
  scale: number; // 10-200 (percentage of original size)
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
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
  // New fields
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  originalSize: number;
  convertedSize?: number;
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  mode: 'percentage',
  percentage: 100,
  maxSizeKB: 500,
  scale: 100,
};

export const SUPPORTED_IMAGE_FORMATS = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
];

export const getFileType = (file: File): FileType | null => {
  if (SUPPORTED_IMAGE_FORMATS.includes(file.type)) return 'image';
  if (SUPPORTED_VIDEO_FORMATS.includes(file.type)) return 'video';
  return null;
};

export const getOutputExtension = (type: FileType): string => {
  return type === 'image' ? 'webp' : 'webm';
};

export const getOutputMimeType = (type: FileType): string => {
  return type === 'image' ? 'image/webp' : 'video/webm';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const calculateSizeChange = (original: number, converted: number): { percentage: number; isSmaller: boolean } => {
  const percentage = ((original - converted) / original) * 100;
  return { percentage: Math.abs(percentage), isSmaller: converted < original };
};
