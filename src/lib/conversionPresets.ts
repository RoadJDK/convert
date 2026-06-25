import type { FileType, QualitySettings } from "@/types/converter";

export type ConversionPresetId =
  | "image-web-small"
  | "image-jpeg-small"
  | "image-png-clean"
  | "video-web-small"
  | "video-mp4-archive";

export type ConversionPreset = {
  id: ConversionPresetId;
  label: string;
  description: string;
  fileType: Exclude<FileType, "pdf">;
  settings: QualitySettings;
};

const CONVERSION_PRESETS: ConversionPreset[] = [
  {
    id: "image-web-small",
    label: "E-Mail/Web",
    description: "Kleinere Bilddatei mit guter Qualität",
    fileType: "image",
    settings: {
      mode: "percentage",
      percentage: 85,
      maxSizeKB: 500,
      scale: 100,
      outputFormat: "webp",
    },
  },
  {
    id: "image-jpeg-small",
    label: "Upload klein",
    description: "Für Formulare, Shops und E-Mail-Anhänge",
    fileType: "image",
    settings: {
      mode: "maxSize",
      percentage: 85,
      maxSizeKB: 300,
      scale: 100,
      outputFormat: "jpeg",
    },
  },
  {
    id: "image-png-clean",
    label: "Originalnah",
    description: "Saubere Bilddatei ohne Qualitätsverlust",
    fileType: "image",
    settings: {
      mode: "percentage",
      percentage: 100,
      maxSizeKB: 1500,
      scale: 100,
      outputFormat: "png",
    },
  },
  {
    id: "video-web-small",
    label: "Upload klein",
    description: "Kleineres Video für Web und Chat",
    fileType: "video",
    settings: {
      mode: "percentage",
      percentage: 80,
      maxSizeKB: 5000,
      scale: 75,
      outputFormat: "webm",
    },
  },
  {
    id: "video-mp4-archive",
    label: "Zum Behalten",
    description: "Video im kompatiblen Format mit Originalgrösse",
    fileType: "video",
    settings: {
      mode: "percentage",
      percentage: 100,
      maxSizeKB: 12000,
      scale: 100,
      outputFormat: "mp4",
    },
  },
];

export function getConversionPresets(fileType: FileType): ConversionPreset[] {
  if (fileType === "pdf") return [];
  return CONVERSION_PRESETS.filter((preset) => preset.fileType === fileType);
}

export function applyConversionPreset(
  currentSettings: QualitySettings,
  preset: ConversionPreset,
): QualitySettings {
  return {
    ...currentSettings,
    ...preset.settings,
  };
}
