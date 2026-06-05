import type { FileType } from "@/types/converter";

export interface LocalStats {
  aiRenamesUsed: number;
  imagesConverted: number;
  videosConverted: number;
}

const STORAGE_KEY = "maibach_convert_stats";

export const EMPTY_LOCAL_STATS: LocalStats = {
  aiRenamesUsed: 0,
  imagesConverted: 0,
  videosConverted: 0,
};

const parseStats = (value: string | null): LocalStats => {
  if (!value) return { ...EMPTY_LOCAL_STATS };

  try {
    const parsed = JSON.parse(value) as Partial<LocalStats>;
    return {
      aiRenamesUsed: Number.isFinite(parsed.aiRenamesUsed) ? parsed.aiRenamesUsed! : 0,
      imagesConverted: Number.isFinite(parsed.imagesConverted) ? parsed.imagesConverted! : 0,
      videosConverted: Number.isFinite(parsed.videosConverted) ? parsed.videosConverted! : 0,
    };
  } catch {
    return { ...EMPTY_LOCAL_STATS };
  }
};

export const readLocalStats = (storage: Storage = localStorage): LocalStats => {
  return parseStats(storage.getItem(STORAGE_KEY));
};

export const writeLocalStats = (
  stats: LocalStats,
  storage: Storage = localStorage,
): void => {
  storage.setItem(STORAGE_KEY, JSON.stringify(stats));
};

export const incrementConversionStat = (
  type: FileType,
  storage: Storage = localStorage,
): LocalStats => {
  const current = readLocalStats(storage);
  const next = {
    ...current,
    imagesConverted: current.imagesConverted + (type === "image" ? 1 : 0),
    videosConverted: current.videosConverted + (type === "video" ? 1 : 0),
  };
  writeLocalStats(next, storage);
  return next;
};

export const incrementAIRenameStat = (storage: Storage = localStorage): LocalStats => {
  const current = readLocalStats(storage);
  const next = {
    ...current,
    aiRenamesUsed: current.aiRenamesUsed + 1,
  };
  writeLocalStats(next, storage);
  return next;
};
