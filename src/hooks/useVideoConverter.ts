import { useCallback, useRef } from "react";
import { canReencodeAudioTrack, canReencodeVideoTrack, convertMedia, webcodecsController } from "@remotion/webcodecs";
import type { CropArea, QualitySettings, TrimRange, VideoOutputFormat } from "@/types/converter";
import {
  createVideoConversionStrategy,
  createVideoEncodingPlan,
  createWebCodecsResizeOperation,
} from "@/lib/videoConversionPlan";
import {
  convertWithMediabunny,
  isMediabunnyVideoConversionSupported,
} from "@/lib/mediabunnyVideoConversion";
import { convertWithMediaRecorder } from "@/lib/videoMediaRecorderConversion";
import { extractFrame, getVideoDuration } from "@/lib/videoMetadata";

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
  videoRotation?: 0 | 90 | 180 | 270;
}

type ConversionResult = { blob: Blob; url: string };

const isSafari = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isWebCodecsSupported = () => typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";

export const useVideoConverter = () => {
  const controllerRef = useRef<ReturnType<typeof webcodecsController> | null>(null);

  const convertWithWebCodecs = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions,
    ): Promise<ConversionResult> => {
      onProgress(5);

      controllerRef.current?.abort();
      controllerRef.current = webcodecsController();

      const outputFormat = (options.qualitySettings.outputFormat || "webm") as VideoOutputFormat;
      const encodingPlan = createVideoEncodingPlan(outputFormat);
      const resizeOperation = createWebCodecsResizeOperation({
        dimensions: options.dimensions,
        scale: options.qualitySettings.scale,
      });

      console.log("[VideoConverter] Converting with WebCodecs:", {
        container: encodingPlan.container,
        videoCodec: encodingPlan.videoCodec,
        audioCodec: encodingPlan.audioCodec,
        isSafari: isSafari(),
        resizeOperation,
      });

      const result = await convertMedia({
        src: file,
        container: encodingPlan.container,
        videoCodec: encodingPlan.videoCodec,
        audioCodec: encodingPlan.audioCodec,
        controller: controllerRef.current,
        resize: resizeOperation ?? undefined,
        onProgress: ({ overallProgress }) => {
          if (overallProgress !== null) {
            onProgress(5 + overallProgress * 90);
          }
        },
        onVideoTrack: async ({ track }) => {
          const canReencode = await canReencodeVideoTrack({
            track,
            videoCodec: encodingPlan.videoCodec,
            resizeOperation,
            rotate: 0,
          });
          return canReencode
            ? { type: "reencode", videoCodec: encodingPlan.videoCodec, resize: resizeOperation, rotate: 0 }
            : { type: "copy" };
        },
        onAudioTrack: async ({ track }) => {
          const canReencode = await canReencodeAudioTrack({
            track,
            audioCodec: encodingPlan.audioCodec,
            bitrate: 128000,
            sampleRate: null,
          });
          return canReencode
            ? { type: "reencode", audioCodec: encodingPlan.audioCodec, bitrate: 128000, sampleRate: null }
            : { type: "copy" };
        },
      });

      onProgress(95);
      const blob = await result.save();

      if (!blob || blob.size === 0) {
        throw new Error("Converted video blob is empty");
      }

      const url = URL.createObjectURL(blob);
      onProgress(100);
      return { blob, url };
    },
    [],
  );

  const convertToWebM = useCallback(
    async (
      file: File,
      onProgress: (progress: number) => void,
      options: ConversionOptions,
    ): Promise<ConversionResult> => {
      console.log("[VideoConverter] Starting conversion...", {
        webCodecsSupported: isWebCodecsSupported(),
        isSafari: isSafari(),
        fileName: file.name,
        fileSize: file.size,
        outputFormat: options.qualitySettings.outputFormat,
      });

      const hasCrop = Boolean(options.cropArea);
      const hasRotation = Boolean(options.videoRotation);
      const hasTrim = Boolean(options.trimRange);
      const hasResize = Boolean(options.dimensions) || options.qualitySettings.scale !== 100;
      const strategy = createVideoConversionStrategy({
        webCodecsSupported: isWebCodecsSupported(),
        mediabunnySupported: isMediabunnyVideoConversionSupported(),
        hasCrop,
        hasDimensions: hasResize,
        hasRotation,
        hasTrim,
      });

      if (strategy.engine === "mediabunny") {
        try {
          return await convertWithMediabunny(file, onProgress, options);
        } catch (mediabunnyError) {
          console.warn("[VideoConverter] Mediabunny failed, trying degraded fallback:", mediabunnyError);
        }

        return convertWithMediaRecorder(file, onProgress, options);
      }

      if (strategy.engine === "mediarecorder") {
        if (strategy.degraded) {
          console.warn("[VideoConverter] Using degraded MediaRecorder fallback:", strategy.reason);
        }
        return convertWithMediaRecorder(file, onProgress, options);
      }

      try {
        return await convertWithWebCodecs(file, onProgress, options);
      } catch (webCodecsError) {
        console.warn("[VideoConverter] WebCodecs failed, trying degraded fallback:", webCodecsError);
      }

      return convertWithMediaRecorder(file, onProgress, options);
    },
    [convertWithWebCodecs],
  );

  return { convertToWebM, extractFrame, getVideoDuration };
};
