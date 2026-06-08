import { removeBackground } from "@imgly/background-removal";

type BackgroundRemovalProgress = (key: string, current: number, total: number) => void;

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

export async function removeImageBackground(input: File | Blob, config: BackgroundRemovalConfig): Promise<Blob> {
  return removeBackground(input, config);
}
