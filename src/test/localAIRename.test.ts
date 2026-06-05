import { describe, expect, it } from "vitest";

import { generateLocalAIRename } from "@/lib/localAIRename";
import { createDeviceProfile } from "@/lib/localProcessingEngine";
import { createBrowserRenameModelAdapter, createMockRenameModelAdapter } from "@/lib/renameModelAdapter";

describe("local AI rename", () => {
  it("uses an injected mock model adapter for deterministic CI renames", async () => {
    const deviceProfile = createDeviceProfile({
      hardwareConcurrency: 8,
      deviceMemoryGB: 8,
      webgpu: true,
      webcodecs: true,
      opfs: true,
    });
    const modelAdapter = createMockRenameModelAdapter({
      "whale.jpg": [
        { type: "caption", value: "a large fish in blue water", confidence: 0.54 },
        { type: "object", value: "humpback whale", confidence: 0.91 },
        { type: "class-label", value: "whale", confidence: 0.86 },
      ],
    });

    const name = await generateLocalAIRename({
      originalName: "whale.jpg",
      fileType: "image",
      file: new File(["fixture"], "whale.jpg", { type: "image/jpeg" }),
      deviceProfile,
      modelAdapter,
    });

    expect(name).toBe("humpback-whale");
    expect(modelAdapter.calls).toEqual([
      {
        originalName: "whale.jpg",
        fileType: "image",
        deviceTier: "high",
        imageInputCount: 0,
      },
    ]);
  });

  it("keeps Florence and SmolVLM adapters behind an explicit local loader", async () => {
    const deviceProfile = createDeviceProfile({
      hardwareConcurrency: 4,
      deviceMemoryGB: 4,
      webgpu: true,
      webcodecs: true,
      opfs: true,
    });
    const loadedFamilies: string[] = [];
    const adapter = createBrowserRenameModelAdapter({
      family: "florence",
      loadModel: async ({ family, deviceProfile }) => {
        loadedFamilies.push(`${family}:${deviceProfile.tier}`);
        return {
          async analyze() {
            return [{ type: "object", value: "invoice scanner", confidence: 0.88 }];
          },
        };
      },
    });

    const signals = await adapter.analyze({
      originalName: "scan.png",
      fileType: "image",
      imageInputs: ["data:image/jpeg;base64,fixture"],
      deviceProfile,
    });

    expect(adapter.id).toBe("florence-rename-model");
    expect(adapter.requiresImageInputs).toBe(true);
    expect(loadedFamilies).toEqual(["florence:mid"]);
    expect(signals).toEqual([{ type: "object", value: "invoice scanner", confidence: 0.88 }]);
  });
});
