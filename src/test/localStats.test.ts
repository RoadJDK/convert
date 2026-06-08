import { beforeEach, describe, expect, it } from "vitest";
import {
  incrementAIRenameStat,
  incrementConversionStat,
  readLocalStats,
  writeLocalStats,
} from "@/lib/localStats";

describe("localStats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at zero when no local stats exist", () => {
    expect(readLocalStats()).toEqual({
      aiRenamesUsed: 0,
      imagesConverted: 0,
      pdfsConverted: 0,
      videosConverted: 0,
    });
  });

  it("tracks image, video, PDF and AI rename counts locally", () => {
    incrementConversionStat("image");
    incrementConversionStat("video");
    incrementConversionStat("pdf");
    incrementAIRenameStat();

    expect(readLocalStats()).toEqual({
      aiRenamesUsed: 1,
      imagesConverted: 1,
      pdfsConverted: 1,
      videosConverted: 1,
    });
  });

  it("recovers from invalid stored values", () => {
    localStorage.setItem("maibach_convert_stats", "{bad json");

    expect(readLocalStats()).toEqual({
      aiRenamesUsed: 0,
      imagesConverted: 0,
      pdfsConverted: 0,
      videosConverted: 0,
    });

    writeLocalStats({ aiRenamesUsed: 2, imagesConverted: 3, pdfsConverted: 5, videosConverted: 4 });
    expect(readLocalStats().imagesConverted).toBe(3);
    expect(readLocalStats().pdfsConverted).toBe(5);
  });
});
