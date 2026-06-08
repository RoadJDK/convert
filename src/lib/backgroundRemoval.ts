import { removeBackground } from "@imgly/background-removal";

type BackgroundRemovalProgress = (key: string, current: number, total: number) => void;

export const BACKGROUND_REMOVAL_ASSET_VERSION = "1.7.0";
export const BACKGROUND_REMOVAL_SELF_HOSTED_PUBLIC_PATH = `/vendor/background-removal/${BACKGROUND_REMOVAL_ASSET_VERSION}/dist/`;
export const BACKGROUND_REMOVAL_REMOTE_PUBLIC_PATH =
  `https://staticimgly.com/@imgly/background-removal-data/${BACKGROUND_REMOVAL_ASSET_VERSION}/dist/`;

export const BACKGROUND_REMOVAL_ASSET_PACKAGE = {
  name: "@imgly/background-removal-data",
  version: BACKGROUND_REMOVAL_ASSET_VERSION,
  url: `https://staticimgly.com/@imgly/background-removal-data/${BACKGROUND_REMOVAL_ASSET_VERSION}/package.tgz`,
  bytes: 284706412,
  destinationPublicPath: BACKGROUND_REMOVAL_SELF_HOSTED_PUBLIC_PATH,
} as const;

export type BackgroundRemovalConfig = {
  publicPath: string;
  model: "isnet" | "isnet_fp16" | "isnet_quint8";
  device: "cpu";
  progress: BackgroundRemovalProgress;
  output: {
    format: "image/png";
    quality: number;
  };
};

export type BackgroundRemovalAssetPlan = {
  mode: "self-hosted" | "remote-fallback";
  publicPath: string;
  selfHostedPublicPath: string;
  remotePublicPath: string;
  localProcessingOnly: true;
  privateFileUpload: false;
  package: typeof BACKGROUND_REMOVAL_ASSET_PACKAGE;
  warning?: string;
};

type BackgroundRemovalAssetPlanInput = {
  localAssetsAvailable?: boolean;
  selfHostedPublicPath?: string;
  remotePublicPath?: string;
};

type CreateBackgroundRemovalConfigInput = {
  publicPath: string;
  progress: BackgroundRemovalProgress;
  model?: BackgroundRemovalConfig["model"];
};

type BackgroundRemovalWithAssetFallbackInput = {
  progress: BackgroundRemovalProgress;
  allowRemoteFallback?: boolean;
  selfHostedPublicPath?: string;
  remotePublicPath?: string;
  onAssetFallback?: (error: Error) => void;
};

function normalizePublicPath(publicPath: string): string {
  return publicPath.endsWith("/") ? publicPath : `${publicPath}/`;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createBackgroundRemovalAssetPlan(
  input: BackgroundRemovalAssetPlanInput = {},
): BackgroundRemovalAssetPlan {
  const selfHostedPublicPath = normalizePublicPath(
    input.selfHostedPublicPath ?? BACKGROUND_REMOVAL_SELF_HOSTED_PUBLIC_PATH,
  );
  const remotePublicPath = normalizePublicPath(
    input.remotePublicPath ?? BACKGROUND_REMOVAL_REMOTE_PUBLIC_PATH,
  );

  if (input.localAssetsAvailable === false) {
    return {
      mode: "remote-fallback",
      publicPath: remotePublicPath,
      selfHostedPublicPath,
      remotePublicPath,
      localProcessingOnly: true,
      privateFileUpload: false,
      package: BACKGROUND_REMOVAL_ASSET_PACKAGE,
      warning:
        "Model- und WASM-Assets fehlen im App-Bundle; es wird nur auf die versionierten IMG.LY-Assets ausgewichen, keine privaten Bilddaten werden hochgeladen.",
    };
  }

  return {
    mode: "self-hosted",
    publicPath: selfHostedPublicPath,
    selfHostedPublicPath,
    remotePublicPath,
    localProcessingOnly: true,
    privateFileUpload: false,
    package: BACKGROUND_REMOVAL_ASSET_PACKAGE,
  };
}

export function createBackgroundRemovalConfig(input: CreateBackgroundRemovalConfigInput): BackgroundRemovalConfig {
  return {
    publicPath: normalizePublicPath(input.publicPath),
    model: input.model ?? "isnet_fp16",
    device: "cpu",
    progress: input.progress,
    output: {
      format: "image/png",
      quality: 1,
    },
  };
}

export async function removeImageBackground(input: File | Blob, config: BackgroundRemovalConfig): Promise<Blob> {
  return removeBackground(input, config);
}

export async function removeImageBackgroundWithAssetFallback(
  input: File | Blob,
  options: BackgroundRemovalWithAssetFallbackInput,
): Promise<Blob> {
  const selfHostedPlan = createBackgroundRemovalAssetPlan({
    localAssetsAvailable: true,
    selfHostedPublicPath: options.selfHostedPublicPath,
    remotePublicPath: options.remotePublicPath,
  });

  try {
    return await removeImageBackground(
      input,
      createBackgroundRemovalConfig({
        publicPath: selfHostedPlan.publicPath,
        progress: options.progress,
      }),
    );
  } catch (error) {
    if (options.allowRemoteFallback === false) {
      throw error;
    }

    const fallbackError = normalizeError(error);
    options.onAssetFallback?.(fallbackError);

    const remotePlan = createBackgroundRemovalAssetPlan({
      localAssetsAvailable: false,
      selfHostedPublicPath: selfHostedPlan.selfHostedPublicPath,
      remotePublicPath: selfHostedPlan.remotePublicPath,
    });

    return removeImageBackground(
      input,
      createBackgroundRemovalConfig({
        publicPath: remotePlan.publicPath,
        progress: options.progress,
      }),
    );
  }
}
