import type {
  FileType,
  ImageOutputFormat,
  OutputFormat,
  PdfOutputFormat,
  VideoOutputFormat,
} from "@/types/converter";

type FormatCapability = {
  readonly mimeTypes: readonly string[];
  readonly extensions: readonly string[];
  readonly type: FileType;
};

type OutputFormatOption<TFormat extends OutputFormat> = {
  readonly value: TFormat;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
};

const IMAGE_CAPABILITIES: readonly FormatCapability[] = [
  {
    type: "image",
    mimeTypes: ["image/webp"],
    extensions: ["webp"],
  },
  {
    type: "image",
    mimeTypes: ["image/png"],
    extensions: ["png"],
  },
  {
    type: "image",
    mimeTypes: ["image/jpeg", "image/jpg"],
    extensions: ["jpg", "jpeg"],
  },
  {
    type: "image",
    mimeTypes: ["image/gif"],
    extensions: ["gif"],
  },
  {
    type: "image",
    mimeTypes: ["image/bmp"],
    extensions: ["bmp"],
  },
  {
    type: "image",
    mimeTypes: ["image/tiff"],
    extensions: ["tif", "tiff"],
  },
  {
    type: "image",
    mimeTypes: ["image/svg+xml"],
    extensions: ["svg"],
  },
  {
    type: "image",
    mimeTypes: ["image/heic", "image/heif"],
    extensions: ["heic", "heif"],
  },
] as const;

const VIDEO_CAPABILITIES: readonly FormatCapability[] = [
  {
    type: "video",
    mimeTypes: ["video/webm"],
    extensions: ["webm"],
  },
  {
    type: "video",
    mimeTypes: ["video/mp4"],
    extensions: ["mp4", "m4v"],
  },
  {
    type: "video",
    mimeTypes: ["video/quicktime"],
    extensions: ["mov", "qt"],
  },
  {
    type: "video",
    mimeTypes: ["video/x-msvideo"],
    extensions: ["avi"],
  },
  {
    type: "video",
    mimeTypes: ["video/x-matroska"],
    extensions: ["mkv"],
  },
  {
    type: "video",
    mimeTypes: ["video/mpeg"],
    extensions: ["mpeg", "mpg"],
  },
  {
    type: "video",
    mimeTypes: ["video/ogg"],
    extensions: ["ogv", "ogg"],
  },
  {
    type: "video",
    mimeTypes: ["video/3gpp"],
    extensions: ["3gp"],
  },
  {
    type: "video",
    mimeTypes: ["video/x-flv"],
    extensions: ["flv"],
  },
  {
    type: "video",
    mimeTypes: ["video/x-ms-wmv"],
    extensions: ["wmv"],
  },
] as const;

const PDF_CAPABILITIES: readonly FormatCapability[] = [
  {
    type: "pdf",
    mimeTypes: ["application/pdf"],
    extensions: ["pdf"],
  },
] as const;

export const INPUT_FORMAT_CAPABILITIES = [
  ...IMAGE_CAPABILITIES,
  ...VIDEO_CAPABILITIES,
  ...PDF_CAPABILITIES,
] as const;

export const SUPPORTED_IMAGE_MIME_TYPES = IMAGE_CAPABILITIES.flatMap((format) => format.mimeTypes);
export const SUPPORTED_VIDEO_MIME_TYPES = VIDEO_CAPABILITIES.flatMap((format) => format.mimeTypes);
export const SUPPORTED_PDF_MIME_TYPES = PDF_CAPABILITIES.flatMap((format) => format.mimeTypes);

export const IMAGE_OUTPUT_OPTIONS: readonly OutputFormatOption<ImageOutputFormat>[] = [
  { value: "webp", label: "WebP", extension: "webp", mimeType: "image/webp" },
  { value: "jpeg", label: "JPEG", extension: "jpg", mimeType: "image/jpeg" },
  { value: "png", label: "PNG", extension: "png", mimeType: "image/png" },
  { value: "avif", label: "AVIF", extension: "avif", mimeType: "image/avif" },
  { value: "gif", label: "GIF", extension: "gif", mimeType: "image/gif" },
  { value: "bmp", label: "BMP", extension: "bmp", mimeType: "image/bmp" },
  { value: "svg", label: "SVG", extension: "svg", mimeType: "image/svg+xml" },
] as const;

export const VIDEO_OUTPUT_OPTIONS: readonly OutputFormatOption<VideoOutputFormat>[] = [
  { value: "webm", label: "WebM", extension: "webm", mimeType: "video/webm" },
  { value: "mp4", label: "MP4", extension: "mp4", mimeType: "video/mp4" },
] as const;

export const PDF_OUTPUT_OPTIONS: readonly OutputFormatOption<PdfOutputFormat>[] = [
  { value: "pdf", label: "PDF", extension: "pdf", mimeType: "application/pdf" },
] as const;

export function detectFileType(file: File): FileType | null {
  const mimeType = file.type.toLowerCase();
  const extension = getExtension(file.name);

  const capability = INPUT_FORMAT_CAPABILITIES.find((format) => {
    if (mimeType && format.mimeTypes.includes(mimeType)) return true;
    return extension ? format.extensions.includes(extension) : false;
  });

  return capability?.type ?? null;
}

export function getDefaultOutputFormat(type: FileType): OutputFormat {
  if (type === "image") return "webp";
  if (type === "video") return "webm";
  return "pdf";
}

export function getOutputFormatOptions(type: FileType): readonly OutputFormatOption<OutputFormat>[] {
  if (type === "image") return IMAGE_OUTPUT_OPTIONS;
  if (type === "video") return VIDEO_OUTPUT_OPTIONS;
  return PDF_OUTPUT_OPTIONS;
}

export function getOutputExtensionForFormat(type: FileType, format?: OutputFormat): string {
  const resolvedFormat = format ?? getDefaultOutputFormat(type);
  return findOutputOption(type, resolvedFormat)?.extension ?? resolvedFormat;
}

export function getOutputMimeTypeForFormat(type: FileType, format?: OutputFormat): string {
  const resolvedFormat = format ?? getDefaultOutputFormat(type);
  const option = findOutputOption(type, resolvedFormat);
  if (!option) {
    throw new Error(`Unsupported ${type} output format: ${resolvedFormat}`);
  }
  return option.mimeType;
}

function findOutputOption(type: FileType, format: OutputFormat) {
  return getOutputFormatOptions(type).find((option) => option.value === format);
}

function getExtension(fileName: string): string | null {
  const lastSegment = fileName.split(/[\\/]/).pop() ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}
