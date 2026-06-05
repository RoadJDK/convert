import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Crop } from "react-image-crop";
import { centerAspectCrop } from "@/lib/cropMath";

type Dimensions = { width: number; height: number };

type UseVideoTrimControllerParams = {
  videoRef: RefObject<HTMLVideoElement>;
  onCropChange: (crop: Crop | undefined) => void;
  onMediaDimensions: (dimensions: Dimensions) => void;
};

export function useVideoTrimController({
  videoRef,
  onCropChange,
  onMediaDimensions,
}: UseVideoTrimControllerParams) {
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);

  useEffect(() => {
    trimStartRef.current = trimStart;
    trimEndRef.current = trimEnd;
  }, [trimStart, trimEnd]);

  const onVideoLoad = useCallback(() => {
    if (!videoRef.current) return;

    const { videoWidth, videoHeight, duration } = videoRef.current;
    onMediaDimensions({ width: videoWidth, height: videoHeight });
    setVideoDuration(duration);
    setTrimStart(0);
    setTrimEnd(duration);
    setCurrentTime(0);
    onCropChange(centerAspectCrop(videoWidth, videoHeight, videoWidth / videoHeight));
  }, [onCropChange, onMediaDimensions, videoRef]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;

    const time = videoRef.current.currentTime;
    const endTime = trimEndRef.current;
    const startTime = trimStartRef.current;

    if (endTime > 0 && time >= endTime) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = endTime;
      setCurrentTime(endTime);
      return;
    }

    if (time < startTime) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      return;
    }

    setCurrentTime(time);
  }, [videoRef]);

  const handleRangeChange = useCallback(
    (values: number[]) => {
      if (!Array.isArray(values) || values.length !== 2) return;

      const minGap = 0.1;
      let start = values[0];
      let end = values[1];

      start = Math.max(0, Math.min(start, end - minGap));
      end = Math.min(videoDuration, Math.max(end, start + minGap));

      setTrimStart(start);
      setTrimEnd(end);
      setCurrentTime((previous) => {
        if (previous < start) return start;
        if (previous > end) return end;
        return previous;
      });

      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        const movedStart = Math.abs(values[0] - trimStart) > Math.abs(values[1] - trimEnd);
        videoRef.current.currentTime = movedStart ? start : end;
      }
    },
    [trimEnd, trimStart, videoDuration, videoRef],
  );

  const handlePositionChange = useCallback(
    (values: number[]) => {
      if (!Array.isArray(values) || values.length !== 1) return;

      const position = Math.max(trimStart, Math.min(trimEnd, values[0]));
      setCurrentTime(position);

      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = position;
      }
    },
    [trimEnd, trimStart, videoRef],
  );

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd - 0.05) {
        videoRef.current.currentTime = trimStart;
        setCurrentTime(trimStart);
      }
      videoRef.current.play();
    }

    setIsPlaying(!isPlaying);
  }, [isPlaying, trimEnd, trimStart, videoRef]);

  const resetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(videoDuration);
    setCurrentTime(0);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [videoDuration, videoRef]);

  const stopPlayback = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, [videoRef]);

  return {
    currentTime,
    handlePositionChange,
    handleRangeChange,
    handleVideoTimeUpdate,
    isPlaying,
    onVideoLoad,
    resetTrim,
    stopPlayback,
    togglePlayPause,
    trimEnd,
    trimStart,
    videoDuration,
  };
}
