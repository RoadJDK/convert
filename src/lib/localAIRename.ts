import type { FileType } from "@/types/converter";
import { buildRenameCandidate, selectVideoFrameTimes } from "@/lib/renamePlan";
import { readDisplayableImageAsDataUrl } from "@/lib/displayableImage";

type LocalAIRenameInput = {
  originalName: string;
  fileType: FileType;
  file?: File;
};

type ImageToTextOutput = { generated_text: string };
type ImageToTextPipeline = (input: string) => Promise<ImageToTextOutput | ImageToTextOutput[]>;
type TransformersModule = {
  pipeline: (
    task: "image-to-text",
    model: string,
    options?: { device?: "webgpu" },
  ) => Promise<ImageToTextPipeline>;
};

const TRANSFORMERS_MODULE_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
const IMAGE_CAPTION_MODEL = "Xenova/vit-gpt2-image-captioning";
const CAPTION_IMAGE_SIZE = 448;

let captionerPromise: Promise<ImageToTextPipeline> | null = null;

export async function generateLocalAIRename({
  originalName,
  fileType,
  file,
}: LocalAIRenameInput): Promise<string> {
  if (!file) {
    return buildRenameCandidate({ captions: [], originalName, fileType });
  }

  const imageInputs = fileType === "video"
    ? await extractVideoFrameDataUrls(file)
    : [await resizeImageToDataUrl(file)];

  const captions = await captionImages(imageInputs);
  return buildRenameCandidate({ captions, originalName, fileType });
}

async function captionImages(imageInputs: string[]): Promise<string[]> {
  const captioner = await getCaptioner();
  const captions: string[] = [];

  for (const imageInput of imageInputs) {
    const result = await captioner(imageInput);
    const firstResult = Array.isArray(result) ? result[0] : result;
    if (firstResult?.generated_text) {
      captions.push(firstResult.generated_text);
    }
  }

  return captions;
}

async function getCaptioner(): Promise<ImageToTextPipeline> {
  captionerPromise ??= createCaptioner();
  return captionerPromise;
}

async function createCaptioner(): Promise<ImageToTextPipeline> {
  const module = (await import(/* @vite-ignore */ TRANSFORMERS_MODULE_URL)) as TransformersModule;

  if (supportsWebGPU()) {
    try {
      return await module.pipeline("image-to-text", IMAGE_CAPTION_MODEL, { device: "webgpu" });
    } catch (error) {
      console.warn("[localAIRename] WebGPU caption model failed, falling back to WASM", error);
    }
  }

  return module.pipeline("image-to-text", IMAGE_CAPTION_MODEL);
}

async function extractVideoFrameDataUrls(file: File): Promise<string[]> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const url = URL.createObjectURL(file);

  try {
    video.src = url;
    await waitForMediaEvent(video, "loadedmetadata");

    const frameTimes = selectVideoFrameTimes(video.duration);
    const frames: string[] = [];

    for (const time of frameTimes) {
      frames.push(await captureVideoFrame(video, time));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
    try {
      video.load();
    } catch {
      // ignore cleanup failures
    }
  }
}

async function captureVideoFrame(video: HTMLVideoElement, time: number): Promise<string> {
  const safeTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));

  if (Math.abs(video.currentTime - safeTime) > 0.01) {
    video.currentTime = safeTime;
    await waitForMediaEvent(video, "seeked");
  }

  if (video.readyState < 2) {
    await waitForMediaEvent(video, "loadeddata");
  }

  return drawMediaToDataUrl(video, video.videoWidth || 640, video.videoHeight || 360);
}

async function resizeImageToDataUrl(file: File): Promise<string> {
  const image = new Image();
  const dataUrl = await readDisplayableImageAsDataUrl(file);

  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();

  return drawMediaToDataUrl(image, image.naturalWidth || CAPTION_IMAGE_SIZE, image.naturalHeight || CAPTION_IMAGE_SIZE);
}

function drawMediaToDataUrl(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const scale = Math.min(1, CAPTION_IMAGE_SIZE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function waitForMediaEvent<TEventName extends keyof HTMLMediaElementEventMap>(
  element: HTMLMediaElement,
  eventName: TEventName,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, 5000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      element.removeEventListener(eventName, onEvent);
      element.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Media failed to load"));
    };

    element.addEventListener(eventName, onEvent, { once: true });
    element.addEventListener("error", onError, { once: true });
  });
}

function supportsWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
