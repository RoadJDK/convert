import { convertMedia } from "@remotion/webcodecs";
import type { CropArea, QualitySettings, TrimRange, VideoOutputFormat, VideoRotation } from "@/types/converter";
import { applyWatermarkCleanup } from "@/lib/watermarkCleanup";
import {
  chooseMediaRecorderMimeType,
  createVideoEncodingPlan,
  resolveRenderedVideoCleanupArea,
  resolveVideoRenderPlan,
} from "@/lib/videoConversionPlan";

type ConversionOptions = {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  cleanupArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
  videoRotation?: VideoRotation;
  removeWatermark?: boolean;
};

type ConversionResult = { blob: Blob; url: string };

type VideoElementWithOptionalCapture = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  captureStream?: () => MediaStream;
};

export async function convertWithMediaRecorder(
  file: File,
  onProgress: (progress: number) => void,
  options: ConversionOptions,
): Promise<ConversionResult> {
  onProgress(5);

  const outputFormat = (options.qualitySettings.outputFormat || "webm") as VideoOutputFormat;

  return new Promise((resolve, reject) => {
    const video = createHiddenVideoElement(file);
    const fileUrl = video.dataset.fileUrl ?? "";

    const cleanup = () => {
      URL.revokeObjectURL(fileUrl);
      try {
        video.pause();
      } catch {
        // ignore cleanup failures
      }
      video.parentNode?.removeChild(video);
      video.src = "";
      try {
        video.load();
      } catch {
        // ignore cleanup failures
      }
    };

    video.onloadeddata = async () => {
      const renderPlan = resolveVideoRenderPlan({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration,
        cropArea: options.cropArea,
        dimensions: options.dimensions,
        scale: options.qualitySettings.scale,
        trimRange: options.trimRange,
        videoRotation: options.videoRotation,
      });

      const canvas = document.createElement("canvas");
      canvas.width = renderPlan.target.width;
      canvas.height = renderPlan.target.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        cleanup();
        reject(new Error("Canvas context not available"));
        return;
      }

      const renderedCleanupArea = resolveRenderedVideoCleanupArea({
        cleanupArea: options.cleanupArea,
        renderPlan,
        sourceSize: { width: video.videoWidth, height: video.videoHeight },
      });
      const cleanupFrame = Boolean(options.removeWatermark);

      const mimeType = chooseMediaRecorderMimeType(outputFormat);
      if (!mimeType) {
        cleanup();
        reject(new Error("Kein unterstütztes Video-Format gefunden"));
        return;
      }

      const stream = canvas.captureStream(30);
      addOriginalAudioTracks(video, stream);

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        finishRecording({
          chunks,
          cleanup,
          mimeType,
          onProgress,
          outputFormat,
          resolve,
          reject,
        });
      };

      recorder.onerror = () => {
        cleanup();
        reject(new Error("MediaRecorder error"));
      };

      const startRecording = async () => {
        await drawInitialFrame({
          canvas,
          cleanupArea: renderedCleanupArea,
          cleanupFrame,
          ctx,
          renderPlan,
          video,
        });
        recorder.start(250);
        onProgress(20);
        await video.play();
        tickRecorder({
          canvas,
          cleanupArea: renderedCleanupArea,
          cleanupFrame,
          ctx,
          recorder,
          renderPlan,
          targetHeight: canvas.height,
          targetWidth: canvas.width,
          video,
          onProgress,
        });
      };

      if (renderPlan.trim.safeStart > 0) {
        video.currentTime = renderPlan.trim.safeStart;
        video.onseeked = () => {
          video.onseeked = null;
          startRecording().catch(reject);
        };
      } else {
        video.currentTime = 0;
        startRecording().catch(reject);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video"));
    };
  });
}

function createHiddenVideoElement(file: File): HTMLVideoElement {
  const video = document.createElement("video");
  const fileUrl = URL.createObjectURL(file);

  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.setAttribute("aria-hidden", "true");
  video.dataset.fileUrl = fileUrl;
  video.src = fileUrl;
  document.body.appendChild(video);

  return video;
}

function addOriginalAudioTracks(video: HTMLVideoElement, stream: MediaStream) {
  try {
    const originalStream = (video as VideoElementWithOptionalCapture).captureStream?.();
    originalStream?.getAudioTracks?.().forEach((track: MediaStreamTrack) => stream.addTrack(track));
  } catch {
    console.log("[VideoConverter] Could not capture audio track");
  }
}

async function waitForFrame(video: HTMLVideoElement): Promise<void> {
  const videoWithFrameCallback = video as VideoElementWithOptionalCapture;
  if (videoWithFrameCallback.requestVideoFrameCallback) {
    await new Promise<void>((resolve) => videoWithFrameCallback.requestVideoFrameCallback?.(() => resolve()));
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
}

async function drawInitialFrame({
  canvas,
  cleanupArea,
  cleanupFrame,
  ctx,
  renderPlan,
  video,
}: {
  canvas: HTMLCanvasElement;
  cleanupArea?: CropArea;
  cleanupFrame: boolean;
  ctx: CanvasRenderingContext2D;
  renderPlan: ReturnType<typeof resolveVideoRenderPlan>;
  video: HTMLVideoElement;
}) {
  try {
    await waitForFrame(video);
    if (video.readyState >= 2) {
      drawVideoFrame(video, ctx, canvas.width, canvas.height, renderPlan);
      cleanupVideoFrame(canvas, cleanupFrame, cleanupArea);
    }
  } catch {
    // ignore best-effort first frame failures
  }
}

function tickRecorder({
  canvas,
  cleanupArea,
  cleanupFrame,
  ctx,
  recorder,
  renderPlan,
  targetHeight,
  targetWidth,
  video,
  onProgress,
}: {
  canvas: HTMLCanvasElement;
  cleanupArea?: CropArea;
  cleanupFrame: boolean;
  ctx: CanvasRenderingContext2D;
  recorder: MediaRecorder;
  renderPlan: ReturnType<typeof resolveVideoRenderPlan>;
  targetHeight: number;
  targetWidth: number;
  video: HTMLVideoElement;
  onProgress: (progress: number) => void;
}) {
  let stopped = false;
  let lastTime = -1;
  let stallSince = performance.now();

  const stopOnce = () => {
    if (stopped) return;
    stopped = true;
    try {
      video.pause();
    } catch {
      // ignore
    }
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
  };

  const tick = () => {
    if (stopped) return;

    if (video.ended || video.currentTime >= renderPlan.trim.end - 0.01) {
      stopOnce();
      return;
    }

    if (video.currentTime === lastTime) {
      if (!video.paused && performance.now() - stallSince > 1200) {
        video.play().catch(() => undefined);
      }
    } else {
      lastTime = video.currentTime;
      stallSince = performance.now();
    }

    if (video.readyState >= 2) {
      drawVideoFrame(video, ctx, targetWidth, targetHeight, renderPlan);
      cleanupVideoFrame(canvas, cleanupFrame, cleanupArea);
    }

    const rel = Math.max(0, Math.min(1, (video.currentTime - renderPlan.trim.start) / renderPlan.trim.duration));
    onProgress(20 + rel * 75);

    const videoWithFrameCallback = video as VideoElementWithOptionalCapture;
    if (videoWithFrameCallback.requestVideoFrameCallback) {
      videoWithFrameCallback.requestVideoFrameCallback(() => tick());
    } else {
      requestAnimationFrame(tick);
    }
  };

  tick();
}

function cleanupVideoFrame(canvas: HTMLCanvasElement, enabled: boolean, cleanupArea?: CropArea) {
  if (!enabled) return;
  applyWatermarkCleanup(canvas, cleanupArea);
}

function drawVideoFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
  renderPlan: ReturnType<typeof resolveVideoRenderPlan>,
) {
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  if (renderPlan.rotation !== 0) {
    ctx.save();
    if (renderPlan.rotation === 90) {
      ctx.translate(targetWidth, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(
        video,
        renderPlan.source.x,
        renderPlan.source.y,
        renderPlan.source.width,
        renderPlan.source.height,
        0,
        0,
        targetHeight,
        targetWidth,
      );
    } else if (renderPlan.rotation === 180) {
      ctx.translate(targetWidth, targetHeight);
      ctx.rotate(Math.PI);
      ctx.drawImage(
        video,
        renderPlan.source.x,
        renderPlan.source.y,
        renderPlan.source.width,
        renderPlan.source.height,
        0,
        0,
        targetWidth,
        targetHeight,
      );
    } else {
      ctx.translate(0, targetHeight);
      ctx.rotate((Math.PI * 3) / 2);
      ctx.drawImage(
        video,
        renderPlan.source.x,
        renderPlan.source.y,
        renderPlan.source.width,
        renderPlan.source.height,
        0,
        0,
        targetHeight,
        targetWidth,
      );
    }
    ctx.restore();
    return;
  }

  ctx.drawImage(
    video,
    renderPlan.source.x,
    renderPlan.source.y,
    renderPlan.source.width,
    renderPlan.source.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );
}

function finishRecording({
  chunks,
  cleanup,
  mimeType,
  onProgress,
  outputFormat,
  resolve,
  reject,
}: {
  chunks: Blob[];
  cleanup: () => void;
  mimeType: string;
  onProgress: (progress: number) => void;
  outputFormat: VideoOutputFormat;
  resolve: (result: ConversionResult) => void;
  reject: (error: Error) => void;
}) {
  (async () => {
    cleanup();

    let blob = new Blob(chunks, { type: mimeType.split(";")[0] });

    if (!blob || blob.size === 0) {
      reject(new Error("Video conversion produced empty file"));
      return;
    }

    const encodingPlan = createVideoEncodingPlan(outputFormat);
    if (blob.type !== encodingPlan.targetMime) {
      onProgress(95);
      const remux = await convertMedia({
        src: blob,
        container: encodingPlan.container,
        videoCodec: encodingPlan.videoCodec,
        audioCodec: encodingPlan.audioCodec,
      });
      blob = await remux.save();
    }

    const url = URL.createObjectURL(blob);
    onProgress(100);
    resolve({ blob, url });
  })().catch((error) => {
    reject(error instanceof Error ? error : new Error("Video conversion failed"));
  });
}
