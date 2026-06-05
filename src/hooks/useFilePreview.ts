import { useEffect, useState } from "react";
import type { ConvertibleFile } from "@/types/converter";
import { createDisplayableImageUrl } from "@/lib/displayableImage";

type Dimensions = { width: number; height: number };

export function useFilePreview(file: ConvertibleFile, videoPreviewUrl?: string) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<Dimensions | undefined>();

  useEffect(() => {
    let cancelled = false;
    let releasePreview: (() => void) | undefined;

    setPreviewUrl(null);
    setOriginalDimensions(undefined);

    if (file.type === "image") {
      void createDisplayableImageUrl(file.file)
        .then((source) => {
          if (cancelled) {
            source.revoke();
            return;
          }

          releasePreview = source.revoke;
          setPreviewUrl(source.url);

          const img = new window.Image();
          img.onload = () => {
            if (!cancelled) {
              setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          };
          img.src = source.url;
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewUrl(null);
          }
        });
    } else {
      const url = URL.createObjectURL(file.file);
      const video = document.createElement("video");
      releasePreview = () => URL.revokeObjectURL(url);

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (!cancelled) {
          setOriginalDimensions({ width: video.videoWidth, height: video.videoHeight });
        }
      };
      video.src = url;
    }

    return () => {
      cancelled = true;
      releasePreview?.();
    };
  }, [file.file, file.type]);

  return {
    originalDimensions,
    showPreview: file.type === "image" ? previewUrl : videoPreviewUrl,
  };
}
