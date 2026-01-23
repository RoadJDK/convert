export type FileType = 'image' | 'video';

export type ConversionStatus = 'pending' | 'converting' | 'completed' | 'error';

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
}

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
