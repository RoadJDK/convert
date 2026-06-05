import { useCallback, useRef } from "react";
import { canReencodeAudioTrack, canReencodeVideoTrack, convertMedia, webcodecsController } from "@remotion/webcodecs";
import type { CropArea, QualitySettings, TrimRange, VideoOutputFormat } from "@/types/converter";
import { createVideoEncodingPlan } from "@/lib/videoConversionPlan";
import { convertWithMediaRecorder } from "@/lib/videoMediaRecorderConversion";
import { extractFrame, getVideoDuration } from "@/lib/videoMetadata";

interface ConversionOptions {
  qualitySettings: QualitySettings;
  cropArea?: CropArea;
  dimensions?: { width: number; height: number };
  trimRange?: TrimRange;
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

      console.log("[VideoConverter] Converting with WebCodecs:", {
        container: encodingPlan.container,
        videoCodec: encodingPlan.videoCodec,
        audioCodec: encodingPlan.audioCodec,
        isSafari: isSafari(),
      });

      const result = await convertMedia({
        src: file,
        container: encodingPlan.container,
        videoCodec: encodingPlan.videoCodec,
        audioCodec: encodingPlan.audioCodec,
        controller: controllerRef.current,
        onProgress: ({ overallProgress }) => {
          if (overallProgress !== null) {
            onProgress(5 + overallProgress * 90);
          }
        },
        onVideoTrack: async ({ track }) => {
          const canReencode = await canReencodeVideoTrack({
            track,
            videoCodec: encodingPlan.videoCodec,
            resizeOperation: null,
            rotate: 0,
          });
          return canReencode
            ? { type: "reencode", videoCodec: encodingPlan.videoCodec, resize: null, rotate: 0 }
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

      const hasEdits = Boolean(options.cropArea || options.dimensions || options.trimRange);

      if (hasEdits) {
        return convertWithMediaRecorder(file, onProgress, options);
      }

      if (isWebCodecsSupported()) {
        try {
          return await convertWithWebCodecs(file, onProgress, options);
        } catch (webCodecsError) {
          console.warn("[VideoConverter] WebCodecs failed, trying fallback:", webCodecsError);
        }
      }

      return convertWithMediaRecorder(file, onProgress, options);
    },
    [convertWithWebCodecs],
  );

  return { convertToWebM, extractFrame, getVideoDuration };
};
