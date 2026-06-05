import type { FileType } from "@/types/converter";
import type { DeviceProfile } from "@/lib/localProcessingEngine";
import type { RenameModelAdapter } from "@/lib/renameModelAdapter";
import { createDeviceProfile } from "@/lib/localProcessingEngine";
import { buildRenamePlan, selectVideoFrameTimes } from "@/lib/renamePlan";
import { createUnavailableRenameModelAdapter } from "@/lib/renameModelAdapter";
import { readDisplayableImageAsDataUrl } from "@/lib/displayableImage";

type LocalAIRenameInput = {
  originalName: string;
  fileType: FileType;
  file?: File;
  deviceProfile?: DeviceProfile;
  modelAdapter?: RenameModelAdapter;
};

const CAPTION_IMAGE_SIZE = 448;

const defaultRenameModelAdapter = createUnavailableRenameModelAdapter();

export async function generateLocalAIRename({
  originalName,
  fileType,
  file,
  deviceProfile = createBrowserDeviceProfile(),
  modelAdapter = defaultRenameModelAdapter,
}: LocalAIRenameInput): Promise<string> {
  const imageInputs = file && modelAdapter.requiresImageInputs
    ? fileType === "video"
      ? await extractVideoFrameDataUrls(file)
      : [await resizeImageToDataUrl(file)]
    : [];

  const signals = await modelAdapter.analyze({
    originalName,
    fileType,
    file,
    imageInputs,
    deviceProfile,
  });
  return buildRenamePlan({ signals, originalName, fileType }).name;
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

function createBrowserDeviceProfile(): DeviceProfile {
  return createDeviceProfile({
    hardwareConcurrency: typeof navigator === "undefined" ? undefined : navigator.hardwareConcurrency,
    deviceMemoryGB: readDeviceMemory(),
    webgpu: supportsWebGPU(),
    webcodecs: supportsWebCodecs(),
    opfs: supportsOPFS(),
    mobile: isLikelyMobile(),
  });
}

function readDeviceMemory(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return navigatorWithMemory.deviceMemory;
}

function supportsWebCodecs(): boolean {
  return typeof globalThis !== "undefined" && "VideoEncoder" in globalThis && "VideoDecoder" in globalThis;
}

function supportsOPFS(): boolean {
  if (typeof navigator === "undefined") return false;
  const storage = navigator.storage as StorageManager & { getDirectory?: unknown };
  return typeof storage?.getDirectory === "function";
}

function isLikelyMobile(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}
