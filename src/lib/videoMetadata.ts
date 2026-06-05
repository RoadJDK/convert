export const extractFrame = async (file: File, timeSeconds: number = 0): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;

    const url = URL.createObjectURL(file);

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const captureFrame = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameDataUrl = canvas.toDataURL("image/jpeg", 0.7);

        cleanup();
        resolve(frameDataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    let hasResolved = false;

    video.onloadeddata = () => {
      if (hasResolved) return;

      if (timeSeconds === 0) {
        hasResolved = true;
        setTimeout(captureFrame, 100);
      } else {
        video.currentTime = Math.min(timeSeconds, video.duration || 0);
      }
    };

    video.onseeked = () => {
      if (hasResolved) return;
      hasResolved = true;
      setTimeout(captureFrame, 50);
    };

    video.onerror = () => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve("");
    };

    setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        resolve("");
      }
    }, 5000);

    video.src = url;
    video.load();
  });
};

export const getVideoDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const url = URL.createObjectURL(file);

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
};
