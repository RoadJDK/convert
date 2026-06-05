import type { FileType } from "@/types/converter";

interface PreviewCandidate {
  id: string;
  type: FileType;
}

export const shouldExtractVideoPreview = (
  file: PreviewCandidate,
  previews: Record<string, string>,
): boolean => {
  return file.type === "video" && !(file.id in previews);
};
