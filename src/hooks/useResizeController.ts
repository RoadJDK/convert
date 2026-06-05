import { useCallback, useEffect, useState } from "react";
import type { Crop } from "react-image-crop";
import { centerAspectCrop, gcd, type Size } from "@/lib/cropMath";

interface UseResizeControllerOptions {
  onCropChange: (crop: Crop | undefined) => void;
}

export const useResizeController = ({ onCropChange }: UseResizeControllerOptions) => {
  const [dimensions, setDimensions] = useState<Size>({ width: 0, height: 0 });
  const [originalDimensions, setOriginalDimensions] = useState<Size>({ width: 0, height: 0 });
  const [aspectLocked, setAspectLocked] = useState(true);
  const [cropAspectLocked, setCropAspectLocked] = useState(false);
  const [aspectWidth, setAspectWidth] = useState(0);
  const [aspectHeight, setAspectHeight] = useState(0);

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      const divisor = gcd(Math.round(dimensions.width), Math.round(dimensions.height));
      setAspectWidth(Math.round(dimensions.width / divisor));
      setAspectHeight(Math.round(dimensions.height / divisor));
    }
  }, [dimensions.width, dimensions.height]);

  const setMediaDimensions = useCallback((size: Size) => {
    setOriginalDimensions(size);
    setDimensions(size);
  }, []);

  const applyCropAspectFromDimensions = useCallback(() => {
    if (originalDimensions.width <= 0 || originalDimensions.height <= 0) return;

    const aspect = dimensions.width > 0 && dimensions.height > 0
      ? dimensions.width / dimensions.height
      : originalDimensions.width / originalDimensions.height;

    onCropChange(centerAspectCrop(originalDimensions.width, originalDimensions.height, aspect));
  }, [dimensions.height, dimensions.width, onCropChange, originalDimensions.height, originalDimensions.width]);

  const handleDimensionChange = useCallback(
    (key: "width" | "height", value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        setDimensions((previous) => ({ ...previous, [key]: num || 0 }));
        return;
      }

      let nextDimensions = { ...dimensions };
      if (aspectLocked && originalDimensions.width > 0 && originalDimensions.height > 0) {
        const ratio = originalDimensions.width / originalDimensions.height;
        nextDimensions = key === "width"
          ? { width: num, height: Math.round(num / ratio) }
          : { width: Math.round(num * ratio), height: num };
      } else {
        nextDimensions = { ...dimensions, [key]: num };
      }

      setDimensions(nextDimensions);

      if (originalDimensions.width > 0 && originalDimensions.height > 0 && nextDimensions.width > 0 && nextDimensions.height > 0) {
        onCropChange(centerAspectCrop(originalDimensions.width, originalDimensions.height, nextDimensions.width / nextDimensions.height));
      }
    },
    [aspectLocked, dimensions, onCropChange, originalDimensions],
  );

  const handleAspectWidthChange = useCallback(
    (value: string) => {
      const width = parseInt(value, 10);
      if (isNaN(width) || width <= 0) {
        setAspectWidth(parseInt(value, 10) || 0);
        return;
      }

      setAspectWidth(width);

      if (aspectLocked && aspectHeight > 0) {
        const nextRatio = width / aspectHeight;
        const nextDimensions = {
          width: Math.round(dimensions.height * nextRatio),
          height: dimensions.height,
        };
        setDimensions(nextDimensions);

        if (cropAspectLocked && originalDimensions.width > 0) {
          onCropChange(centerAspectCrop(originalDimensions.width, originalDimensions.height, nextRatio));
        }
      }
    },
    [aspectHeight, aspectLocked, cropAspectLocked, dimensions.height, onCropChange, originalDimensions],
  );

  const handleAspectHeightChange = useCallback(
    (value: string) => {
      const height = parseInt(value, 10);
      if (isNaN(height) || height <= 0) {
        setAspectHeight(parseInt(value, 10) || 0);
        return;
      }

      setAspectHeight(height);

      if (aspectLocked && aspectWidth > 0) {
        const nextRatio = aspectWidth / height;
        const nextDimensions = {
          width: dimensions.width,
          height: Math.round(dimensions.width / nextRatio),
        };
        setDimensions(nextDimensions);

        if (cropAspectLocked && originalDimensions.width > 0) {
          onCropChange(centerAspectCrop(originalDimensions.width, originalDimensions.height, nextRatio));
        }
      }
    },
    [aspectLocked, aspectWidth, cropAspectLocked, dimensions.width, onCropChange, originalDimensions],
  );

  const toggleAspectLock = useCallback(() => {
    setAspectLocked((previous) => !previous);
  }, []);

  const toggleCropAspect = useCallback(() => {
    setCropAspectLocked((previous) => {
      const next = !previous;
      if (next) applyCropAspectFromDimensions();
      return next;
    });
  }, [applyCropAspectFromDimensions]);

  const resetDimensions = useCallback(() => {
    setDimensions(originalDimensions);
    setAspectWidth(0);
    setAspectHeight(0);
  }, [originalDimensions]);

  const resetAspectInputs = useCallback(() => {
    setAspectWidth(0);
    setAspectHeight(0);
  }, []);

  return {
    aspectHeight,
    aspectLocked,
    aspectWidth,
    cropAspectLocked,
    dimensions,
    originalDimensions,
    handleAspectHeightChange,
    handleAspectWidthChange,
    handleDimensionChange,
    resetAspectInputs,
    resetDimensions,
    setDimensions,
    setMediaDimensions,
    toggleAspectLock,
    toggleCropAspect,
  };
};
