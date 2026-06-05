type BackgroundRemovalProgress = (key: string, current: number, total: number) => void;

export type BackgroundRemovalConfig = {
  publicPath: string;
  model: string;
  device: "cpu";
  progress: BackgroundRemovalProgress;
  output: {
    format: "image/png";
    quality: number;
  };
};

type BackgroundRemovalModule = {
  removeBackground: (input: File | Blob, config: BackgroundRemovalConfig) => Promise<Blob>;
};

const BACKGROUND_REMOVAL_MODULE_URL = "https://esm.sh/@imgly/background-removal@1.7.0";

export async function removeImageBackground(input: File | Blob, config: BackgroundRemovalConfig): Promise<Blob> {
  const module = (await import(/* @vite-ignore */ BACKGROUND_REMOVAL_MODULE_URL)) as BackgroundRemovalModule;
  return module.removeBackground(input, config);
}
