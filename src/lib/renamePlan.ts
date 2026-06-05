import type { FileType } from "@/types/converter";

type RenameInput = {
  captions: string[];
  originalName: string;
  fileType: FileType;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "background",
  "black",
  "blue",
  "brown",
  "by",
  "close",
  "closeup",
  "file",
  "for",
  "gray",
  "green",
  "grey",
  "image",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "photo",
  "picture",
  "red",
  "screenshot",
  "the",
  "to",
  "video",
  "white",
  "with",
]);

const GENERIC_NAMES = new Set(["file", "image", "photo", "picture", "screenshot", "video", "clip"]);

export function buildRenameCandidate({ captions, originalName, fileType }: RenameInput): string {
  const captionName = captionsToFilename(captions);
  if (captionName && !GENERIC_NAMES.has(captionName)) {
    return captionName;
  }

  const fallback = sanitizeFilenameBase(originalName);
  if (fallback && !GENERIC_NAMES.has(fallback)) {
    return fallback;
  }

  return fileType === "video" ? "video-clip" : "image-file";
}

export function sanitizeFilenameBase(value: string): string {
  const baseName = value.replace(/\.[^/.]+$/, "");
  return clampFilename(
    baseName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
  );
}

export function selectVideoFrameTimes(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [0];
  }

  if (duration < 3) {
    return [Math.max(0, duration / 2)];
  }

  const candidates = [duration * 0.2, duration * 0.5, duration * 0.8];
  return candidates.map((time) => Number(time.toFixed(2)));
}

function captionsToFilename(captions: string[]): string | null {
  const counts = new Map<string, number>();

  for (const caption of captions) {
    const words = caption
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.replace(/^-|-$/g, ""))
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  const rankedWords = [...counts.entries()]
    .sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
    .map(([word]) => word);

  return rankedWords.length > 0 ? clampFilename(rankedWords.slice(0, 3).join("-")) : null;
}

function clampFilename(value: string): string {
  const words = value.split("-").filter(Boolean);
  const chosen: string[] = [];

  for (const word of words) {
    const next = [...chosen, word].join("-");
    if (next.length > 25 || chosen.length >= 3) break;
    chosen.push(word);
  }

  return chosen.join("-");
}
