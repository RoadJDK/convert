import type { FileType } from "@/types/converter";

type RenameInput = {
  captions?: string[];
  signals?: RenameSignal[];
  originalName: string;
  fileType: FileType;
};

export type RenameSignalType = "caption" | "object" | "ocr" | "class-label";

export type RenameSignal = {
  type: RenameSignalType;
  value: string;
  confidence?: number;
};

export type RenamePlan = {
  name: string;
  confidence: number;
  fallback: boolean;
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
  return buildRenamePlan({ captions, originalName, fileType }).name;
}

export function buildRenamePlan({ captions = [], signals = [], originalName, fileType }: RenameInput): RenamePlan {
  const modelSignals = normalizeSignals([...captions.map((caption) => ({ type: "caption" as const, value: caption })), ...signals]);
  const strongestModelName = selectStrongModelSignalName(modelSignals);
  const captionTexts = modelSignals.filter((signal) => signal.type === "caption").map((signal) => signal.value);

  if (strongestModelName) {
    return strongestModelName;
  }

  const captionName = captionsToFilename(captionTexts);
  if (captionName && !GENERIC_NAMES.has(captionName)) {
    return {
      name: captionName,
      confidence: 0.62,
      fallback: false,
    };
  }

  const fallback = sanitizeFilenameBase(originalName);
  if (fallback && !GENERIC_NAMES.has(fallback)) {
    return {
      name: fallback,
      confidence: 0.35,
      fallback: true,
    };
  }

  return {
    name: fileType === "video" ? "video-clip" : "image-file",
    confidence: 0.2,
    fallback: true,
  };
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

function normalizeSignals(signals: RenameSignal[]): RenameSignal[] {
  return signals
    .map((signal) => ({
      type: signal.type,
      value: signal.value.trim(),
      confidence: clampConfidence(signal.confidence),
    }))
    .filter((signal) => signal.value.length > 0);
}

function selectStrongModelSignalName(signals: RenameSignal[]): RenamePlan | null {
  const candidates = signals
    .filter((signal) => signal.type !== "caption")
    .map((signal) => {
      const name = signalToFilename(signal.value);
      if (!name || GENERIC_NAMES.has(name)) return null;

      const reinforcement = signals.some(
        (other) => other !== signal && sharesMeaningfulWord(signal.value, other.value),
      )
        ? 0.08
        : 0;

      const plan: RenamePlan = {
        name,
        confidence: Math.min(0.99, signal.confidence + reinforcement),
        fallback: false,
      };
      return plan;
    })
    .filter((candidate): candidate is RenamePlan => candidate !== null)
    .filter((candidate) => candidate.confidence >= 0.7);

  return candidates.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))[0] ?? null;
}

function signalToFilename(value: string): string | null {
  const words = tokenize(value);
  return words.length > 0 ? clampFilename(words.slice(0, 3).join("-")) : null;
}

function sharesMeaningfulWord(left: string, right: string): boolean {
  const rightWords = new Set(tokenize(right));
  return tokenize(left).some((word) => rightWords.has(word));
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-|-$/g, ""))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function clampConfidence(confidence: number | undefined): number {
  if (!Number.isFinite(confidence)) return 0.6;
  return Math.max(0, Math.min(1, confidence));
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
