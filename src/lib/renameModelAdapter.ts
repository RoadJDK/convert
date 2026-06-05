import type { DeviceProfile } from "@/lib/localProcessingEngine";
import type { RenameSignal } from "@/lib/renamePlan";
import type { FileType } from "@/types/converter";

export type RenameModelAdapterInput = {
  originalName: string;
  fileType: FileType;
  file?: File;
  imageInputs: string[];
  deviceProfile: DeviceProfile;
};

export type RenameModelAdapter = {
  id: string;
  requiresImageInputs: boolean;
  analyze(input: RenameModelAdapterInput): Promise<RenameSignal[]>;
};

export type BrowserRenameModelFamily = "florence" | "smolvlm";

export type LoadedBrowserRenameModel = {
  analyze(input: RenameModelAdapterInput): Promise<RenameSignal[]>;
};

export type BrowserRenameModelLoader = (options: {
  family: BrowserRenameModelFamily;
  deviceProfile: DeviceProfile;
}) => Promise<LoadedBrowserRenameModel>;

export type MockRenameModelAdapterCall = {
  originalName: string;
  fileType: FileType;
  deviceTier: DeviceProfile["tier"];
  imageInputCount: number;
};

export type MockRenameModelAdapter = RenameModelAdapter & {
  calls: MockRenameModelAdapterCall[];
};

export function createMockRenameModelAdapter(
  fixtures: Record<string, RenameSignal[]>,
): MockRenameModelAdapter {
  const calls: MockRenameModelAdapterCall[] = [];

  return {
    id: "mock-rename-model",
    requiresImageInputs: false,
    calls,
    async analyze(input) {
      calls.push({
        originalName: input.originalName,
        fileType: input.fileType,
        deviceTier: input.deviceProfile.tier,
        imageInputCount: input.imageInputs.length,
      });

      return fixtures[input.originalName] ?? fixtures[input.file?.name ?? ""] ?? [];
    },
  };
}

export function createBrowserRenameModelAdapter(options: {
  family: BrowserRenameModelFamily;
  loadModel: BrowserRenameModelLoader;
}): RenameModelAdapter {
  return {
    id: `${options.family}-rename-model`,
    requiresImageInputs: true,
    async analyze(input) {
      if (input.imageInputs.length === 0) return [];
      const model = await options.loadModel({
        family: options.family,
        deviceProfile: input.deviceProfile,
      });
      return model.analyze(input);
    },
  };
}

export function createUnavailableRenameModelAdapter(): RenameModelAdapter {
  return {
    id: "unavailable-local-rename-model",
    requiresImageInputs: false,
    async analyze() {
      return [];
    },
  };
}
