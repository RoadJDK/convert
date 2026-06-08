import { describe, expect, it, vi } from "vitest";

const removeBackgroundMock = vi.hoisted(() => vi.fn(async () => new Blob(["clean"], { type: "image/png" })));

vi.mock("@imgly/background-removal", () => ({
  removeBackground: removeBackgroundMock,
}));

import {
  BACKGROUND_REMOVAL_ASSET_PACKAGE,
  createBackgroundRemovalAssetPlan,
  createBackgroundRemovalConfig,
  removeImageBackgroundWithAssetFallback,
} from "@/lib/backgroundRemoval";

describe("background removal asset planning", () => {
  it("prefers self-hosted model assets when they are installed", () => {
    const plan = createBackgroundRemovalAssetPlan({ localAssetsAvailable: true });

    expect(plan.mode).toBe("self-hosted");
    expect(plan.publicPath).toBe("/vendor/background-removal/1.7.0/dist/");
    expect(plan.localProcessingOnly).toBe(true);
    expect(plan.privateFileUpload).toBe(false);
    expect(plan.package).toEqual(BACKGROUND_REMOVAL_ASSET_PACKAGE);
    expect(plan.warning).toBeUndefined();
  });

  it("makes the remote asset fallback explicit when self-hosted assets are missing", () => {
    const plan = createBackgroundRemovalAssetPlan({ localAssetsAvailable: false });

    expect(plan.mode).toBe("remote-fallback");
    expect(plan.publicPath).toBe("https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/");
    expect(plan.selfHostedPublicPath).toBe("/vendor/background-removal/1.7.0/dist/");
    expect(plan.package.bytes).toBe(284706412);
    expect(plan.warning).toContain("Model- und WASM-Assets");
  });

  it("creates the package config from the selected asset public path", () => {
    const config = createBackgroundRemovalConfig({
      publicPath: "/vendor/background-removal/1.7.0/dist/",
      progress: vi.fn(),
    });

    expect(config).toMatchObject({
      publicPath: "/vendor/background-removal/1.7.0/dist/",
      model: "isnet_fp16",
      device: "cpu",
      output: {
        format: "image/png",
        quality: 1,
      },
    });
  });

  it("tries self-hosted assets first and falls back to the versioned CDN asset path", async () => {
    removeBackgroundMock
      .mockRejectedValueOnce(new Error("missing local resources.json"))
      .mockResolvedValueOnce(new Blob(["fallback-clean"], { type: "image/png" }));

    const input = new Blob(["source"], { type: "image/png" });
    const onAssetFallback = vi.fn();

    const result = await removeImageBackgroundWithAssetFallback(input, {
      progress: vi.fn(),
      onAssetFallback,
    });

    expect(result.type).toBe("image/png");
    expect(removeBackgroundMock).toHaveBeenNthCalledWith(
      1,
      input,
      expect.objectContaining({ publicPath: "/vendor/background-removal/1.7.0/dist/" }),
    );
    expect(removeBackgroundMock).toHaveBeenNthCalledWith(
      2,
      input,
      expect.objectContaining({ publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/" }),
    );
    expect(onAssetFallback).toHaveBeenCalledWith(expect.any(Error));
  });
});
