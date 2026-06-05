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
      videosConverted: 0,
    });
  });

  it("tracks image, video and AI rename counts locally", () => {
    incrementConversionStat("image");
    incrementConversionStat("video");
    incrementAIRenameStat();

    expect(readLocalStats()).toEqual({
      aiRenamesUsed: 1,
      imagesConverted: 1,
      videosConverted: 1,
    });
  });

  it("recovers from invalid stored values", () => {
    localStorage.setItem("maibach_convert_stats", "{bad json");

    expect(readLocalStats()).toEqual({
      aiRenamesUsed: 0,
      imagesConverted: 0,
      videosConverted: 0,
    });

    writeLocalStats({ aiRenamesUsed: 2, imagesConverted: 3, videosConverted: 4 });
    expect(readLocalStats().imagesConverted).toBe(3);
  });
});
