import { describe, expect, it, vi } from "vitest";

const removeBackgroundMock = vi.hoisted(() => vi.fn(async () => new Blob(["clean"], { type: "image/png" })));

vi.mock("@imgly/background-removal", () => ({
  removeBackground: removeBackgroundMock,
}));

import { removeImageBackground, type BackgroundRemovalConfig } from "@/lib/backgroundRemoval";

describe("removeImageBackground", () => {
  it("uses the bundled browser package instead of remote code imports", async () => {
    const input = new Blob(["source"], { type: "image/png" });
    const config: BackgroundRemovalConfig = {
      device: "cpu",
      model: "isnet_fp16",
      output: {
        format: "image/png",
        quality: 1,
      },
      progress: vi.fn(),
      publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
    };

    const result = await removeImageBackground(input, config);

    expect(result.type).toBe("image/png");
    expect(removeBackgroundMock).toHaveBeenCalledWith(input, config);
  });
});
