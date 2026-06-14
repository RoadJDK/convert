import { expect, test, type Page } from "@playwright/test";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { PDFDocument, rgb } from "pdf-lib";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAdklEQVR4nO3QQQ3AIADAQMAKljLDf5O43Hgw7KUXsHfvewCx78sBEA0gGkA0gGgA0QCiAUQDiAYQDSAaQDSAaADRANIAogFEA4gGEA0gGkA0gGgA0QCiAUQDiAYQDSAaQDSAaADRANIAogFEA4gGEA0gGkA0gGgA0QCiAUQDiH4OawLYl/8YWwAAAABJRU5ErkJggg==",
  "base64",
);

const PDF_EMBED_SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

const CROP_SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAZAAAADwCAIAAAChXqV1AAACZUlEQVR42u3UQQ0AAAjEsHOJJ/zhBxuQNKmCPZbpAnghEgCGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgqAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWCoAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgAhgVgWIBhARgWgGEBhgVwywIz0b+QMT378QAAAABJRU5ErkJggg==",
  "base64",
);

const createCornerWatermarkPng = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#275f73");
    gradient.addColorStop(1, "#d7c68a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#e1122f";
    context.fillRect(4, 36, 32, 22);
    context.fillRect(60, 36, 32, 22);
    context.fillStyle = "#ffffff";
    context.fillRect(12, 43, 16, 4);
    context.fillRect(68, 43, 16, 4);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("PNG encoding failed"));
      }, "image/png");
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return Buffer.from(bytes);
};

const createPdfFixture = async (
  name: string,
  pageCount: number,
  title: string,
  pageSizes: Array<[number, number]> = [],
): Promise<Buffer> => {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Private Author");

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage(pageSizes[index] ?? [240, 160]);
    page.drawText(`${name} page ${index + 1}`, {
      color: rgb(0.12, 0.18, 0.24),
      size: 14,
      x: 28,
      y: 96,
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
};

const toEvenDimension = (value: number) => {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
};

const installPageGuards = (page: Page) => {
  const consoleProblems: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });

  return {
    assertClean: async () => {
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
      expect(consoleProblems).toEqual([]);
      expect(failedRequests).toEqual([]);
    },
  };
};

const getDownloadControl = (page: Page) => page.getByRole("link", { name: "Download", exact: true });

const expectFileCardActionsToFit = async (page: Page) => {
  const metrics = await page.getByTestId("file-card-actions").first().evaluate((actions) => {
    const viewportWidth = window.innerWidth;
    const controls = Array.from(actions.querySelectorAll("button,[role='combobox']")).map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        label:
          control.getAttribute("aria-label") ||
          control.textContent?.replace(/\s+/g, " ").trim() ||
          control.getAttribute("title") ||
          control.tagName,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        offLeft: Math.max(0, Math.round(0 - rect.left)),
        offRight: Math.max(0, Math.round(rect.right - viewportWidth)),
      };
    });

    return { viewportWidth, controls };
  });

  const offscreen = metrics.controls.filter((control) => control.offLeft > 0 || control.offRight > 0);
  expect(offscreen).toEqual([]);

  if (metrics.viewportWidth < 600) {
    const tooSmall = metrics.controls.filter((control) => control.width < 44 || control.height < 44);
    expect(tooSmall).toEqual([]);
  }
};

const expectPendingFileCardActionsToUseMobileToolbar = async (page: Page) => {
  const metrics = await page.getByTestId("file-card-actions").first().evaluate((actions) => {
    const controls = Array.from(actions.querySelectorAll("button,[role='combobox']")).map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        label:
          control.getAttribute("aria-label") ||
          control.textContent?.replace(/\s+/g, " ").trim() ||
          control.getAttribute("title") ||
          control.tagName,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
    const rowTops = [...new Set(controls.map((control) => control.top))].sort((a, b) => a - b);

    return {
      controls,
      rowTops,
      viewportWidth: window.innerWidth,
    };
  });

  expect(metrics.viewportWidth).toBe(360);
  expect(metrics.rowTops).toHaveLength(2);

  const firstRow = metrics.controls.filter((control) => control.top === metrics.rowTops[0]);
  const secondRow = metrics.controls.filter((control) => control.top === metrics.rowTops[1]);
  expect(firstRow.map((control) => control.label)).toEqual([
    "Zielformat",
    "Qualitätseinstellungen",
    "Zuschneiden",
    "KI-Umbenennung",
    "Datei entfernen",
  ]);
  expect(secondRow.map((control) => control.label)).toEqual(["Start"]);

  const startButton = secondRow[0];
  expect(startButton.width).toBeGreaterThanOrEqual(280);
  expect(metrics.controls.filter((control) => control.width < 44 || control.height < 44)).toEqual([]);
  expect(metrics.controls.filter((control) => control.left < 0 || control.right > metrics.viewportWidth)).toEqual([]);
};

const expectFileCardPreviewIconToBeCentered = async (page: Page) => {
  const metrics = await page.getByTestId("file-card-preview").first().evaluate((preview) => {
    const marker = preview.querySelector('[data-testid="file-card-preview-type-icon"]');
    if (!marker) {
      throw new Error("Preview type marker is missing");
    }

    const previewRect = preview.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const previewCenter = {
      x: previewRect.left + previewRect.width / 2,
      y: previewRect.top + previewRect.height / 2,
    };
    const markerCenter = {
      x: markerRect.left + markerRect.width / 2,
      y: markerRect.top + markerRect.height / 2,
    };

    return {
      deltaX: Math.abs(markerCenter.x - previewCenter.x),
      deltaY: Math.abs(markerCenter.y - previewCenter.y),
      marker: {
        width: Math.round(markerRect.width),
        height: Math.round(markerRect.height),
      },
      preview: {
        width: Math.round(previewRect.width),
        height: Math.round(previewRect.height),
      },
    };
  });

  expect(metrics.deltaX).toBeLessThanOrEqual(1);
  expect(metrics.deltaY).toBeLessThanOrEqual(1);
  expect(metrics.marker.width).toBeGreaterThan(0);
  expect(metrics.marker.height).toBeGreaterThan(0);
};

const createSampleWebm = async (
  page: Page,
  dimensions: { width: number; height: number } = { width: 64, height: 64 },
): Promise<Buffer> => {
  const bytes = await page.evaluate(async ({ height, width }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");

    const stream = canvas.captureStream(10);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();
    for (let frame = 0; frame < 12; frame += 1) {
      context.fillStyle = frame % 2 === 0 ? "#d58a57" : "#13151a";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f1ece5";
      context.fillRect(8 + frame, 18, 18, 18);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: "video/webm" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, dimensions);

  return Buffer.from(bytes);
};

const createSampleWebmWithAudio = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("AudioContext unavailable");

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");

    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(destination);

    const stream = canvas.captureStream(10);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    await audioContext.resume();
    oscillator.start();
    recorder.start();
    for (let frame = 0; frame < 16; frame += 1) {
      context.fillStyle = frame % 2 === 0 ? "#244c5a" : "#16181d";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f5d061";
      context.fillRect(10 + frame, 16, 24, 24);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    recorder.stop();
    await stopped;

    oscillator.stop();
    stream.getTracks().forEach((track) => track.stop());
    destination.stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();

    const blob = new Blob(chunks, { type: "video/webm" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return Buffer.from(bytes);
};

const createSampleMp4 = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    if (!MediaRecorder.isTypeSupported("video/mp4")) {
      throw new Error("MP4 MediaRecorder unavailable");
    }

    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/mp4" });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();
    for (let frame = 0; frame < 12; frame += 1) {
      context.fillStyle = frame % 2 === 0 ? "#2f6f5e" : "#101318";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f4f0da";
      context.fillRect(14, 10 + frame, 20, 20);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: "video/mp4" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return Buffer.from(bytes);
};

const installConvertedVideoBlobCapture = async (page: Page) => {
  await page.evaluate(() => {
    const win = window as Window & {
      __convertedVideoBlobs?: Blob[];
      __originalCreateObjectURL?: typeof URL.createObjectURL;
    };

    if (!win.__originalCreateObjectURL) {
      win.__originalCreateObjectURL = URL.createObjectURL.bind(URL);
    }

    win.__convertedVideoBlobs = [];
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type.startsWith("video/")) {
        win.__convertedVideoBlobs?.push(object);
      }
      return win.__originalCreateObjectURL?.(object) ?? "";
    };
  });
};

const installConvertedPdfBlobCapture = async (page: Page) => {
  await page.evaluate(() => {
    const win = window as Window & {
      __convertedImageBlobs?: Blob[];
      __convertedPdfBlobs?: Blob[];
      __originalCreateObjectURL?: typeof URL.createObjectURL;
    };

    if (!win.__originalCreateObjectURL) {
      win.__originalCreateObjectURL = URL.createObjectURL.bind(URL);
    }

    win.__convertedImageBlobs = [];
    win.__convertedPdfBlobs = [];
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type.startsWith("image/")) {
        win.__convertedImageBlobs?.push(object);
      }
      if (object instanceof Blob && object.type === "application/pdf") {
        win.__convertedPdfBlobs?.push(object);
      }
      return win.__originalCreateObjectURL?.(object) ?? "";
    };
  });
};

const readLastConvertedImageMetadata = async (page: Page) =>
  page.evaluate(async () => {
    const blobs = (window as Window & { __convertedImageBlobs?: Blob[] }).__convertedImageBlobs ?? [];
    const blob = blobs.at(-1);
    if (!blob) throw new Error("Missing converted image blob");

    const bitmap = await createImageBitmap(blob);
    const result = {
      height: bitmap.height,
      size: blob.size,
      type: blob.type,
      width: bitmap.width,
    };
    bitmap.close();
    return result;
  });

const readLastConvertedPdfBytes = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const blobs = (window as Window & { __convertedPdfBlobs?: Blob[] }).__convertedPdfBlobs ?? [];
    const blob = blobs.at(-1);
    if (!blob) throw new Error("Missing converted PDF blob");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return Buffer.from(bytes);
};

const readLastConvertedVideoMetadata = async (page: Page) =>
  page.evaluate(async () => {
    const blobs = (window as Window & { __convertedVideoBlobs?: Blob[] }).__convertedVideoBlobs ?? [];
    const blob = blobs.at(-1);
    if (!blob) throw new Error("Missing converted video blob");

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Converted video metadata could not be loaded"));
    });
    const result = {
      duration: video.duration,
      height: video.videoHeight,
      size: blob.size,
      type: blob.type,
      width: video.videoWidth,
    };
    URL.revokeObjectURL(url);
    return result;
  });

const readLastConvertedVideoBytes = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const blobs = (window as Window & { __convertedVideoBlobs?: Blob[] }).__convertedVideoBlobs ?? [];
    const blob = blobs.at(-1);
    if (!blob) throw new Error("Missing converted video blob");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return Buffer.from(bytes);
};

const inspectVideoContainer = async (bytes: Buffer) => {
  const input = new Input({
    source: new BufferSource(bytes),
    formats: ALL_FORMATS,
  });

  try {
    const [audioTracks, duration, videoTracks] = await Promise.all([
      input.getAudioTracks(),
      input.computeDuration(),
      input.getVideoTracks(),
    ]);

    return {
      audioTrackCount: audioTracks.length,
      duration,
      videoTrackCount: videoTracks.length,
    };
  } finally {
    input.dispose();
  }
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("loads the local converter without layout or runtime failures", async ({ page }) => {
  const guards = installPageGuards(page);

  await expect(page.getByText("Dateien rein. Format wählen. Ohne Upload raus.")).toBeVisible();
  await expect(page.getByText("Alles lokal")).toBeVisible();
  await expect(page.getByText("Privat per Default")).toHaveCount(0);

  await guards.assertClean();
});

test("advertises installable offline PWA trust signals", async ({ page }) => {
  const guards = installPageGuards(page);

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.getByText("PWA installierbar")).toBeVisible();
  await expect(page.getByText("Offline nach erstem Laden")).toBeVisible();
  await expect(page.getByText("Keine Upload-Requests für Dateien")).toBeVisible();

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration("/");
        return Boolean(registration);
      });
    }, { timeout: 10000 })
    .toBe(true);

  await guards.assertClean();
});

test("keeps the drop zone stable on pointer hover", async ({ page }) => {
  const guards = installPageGuards(page);
  const dropZone = page.getByTestId("drop-zone");

  const readDropZoneStyle = async () =>
    dropZone.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    });

  const beforeHover = await readDropZoneStyle();
  await dropZone.hover();
  const duringHover = await readDropZoneStyle();
  await page.mouse.move(20, 20);
  const afterHover = await readDropZoneStyle();

  expect(duringHover).toEqual(beforeHover);
  expect(afterHover).toEqual(beforeHover);

  await guards.assertClean();
});

test("shows the drop zone focus ring when the file input receives keyboard focus", async ({ page }) => {
  const guards = installPageGuards(page);
  const dropZone = page.getByTestId("drop-zone");
  const fileInput = page.locator('input[type="file"]');

  let fileInputFocused = false;
  for (let pressCount = 0; pressCount < 8; pressCount += 1) {
    await page.keyboard.press("Tab");
    fileInputFocused = await fileInput.evaluate((input) => input === document.activeElement);
    if (fileInputFocused) break;
  }

  expect(fileInputFocused).toBe(true);

  const focusStyle = await dropZone.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    };
  });

  expect(focusStyle.boxShadow).not.toBe("none");

  await guards.assertClean();
});

test("opens the file picker from the drop-zone copy and compacts after upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const dropZone = page.getByTestId("drop-zone");

  const expandedBox = await dropZone.boundingBox();
  expect(expandedBox?.height).toBeGreaterThan(240);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Dateien hierher ziehen").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "dropzone-click.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  await expect(page.getByAltText("dropzone-click.png")).toBeVisible();
  await expect(dropZone).toHaveAttribute("data-compact", "true");
  await expectFileCardActionsToFit(page);

  await expect
    .poll(async () => (await dropZone.boundingBox())?.height ?? 0, {
      timeout: 2_000,
    })
    .toBeLessThan((expandedBox?.height ?? 0) - 90);

  await guards.assertClean();
});

test("keeps pending file actions as a stable 360px mobile toolbar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "360px toolbar regression is covered by the mobile project");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  const guards = installPageGuards(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "mobile-toolbar.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  await expect(page.getByAltText("mobile-toolbar.png")).toBeVisible();
  await expectFileCardPreviewIconToBeCentered(page);
  await expectFileCardActionsToFit(page);
  await expectPendingFileCardActionsToUseMobileToolbar(page);

  await guards.assertClean();
});

test("converts an image locally and records local stats", async ({ page }) => {
  const guards = installPageGuards(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-sample.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  await expect(page.getByAltText("e2e-sample.png")).toBeVisible();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const stats = await page.evaluate(() => localStorage.getItem("maibach_convert_stats"));
  expect(stats).toContain('"imagesConverted":1');

  await guards.assertClean();
});

test("downloads a converted image from the file card link", async ({ page }) => {
  const guards = installPageGuards(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "single-download.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  await expect(page.getByAltText("single-download.png")).toBeVisible();
  await page.getByRole("button", { name: /^Start$/ }).click();

  const downloadButton = getDownloadControl(page);
  await expect(downloadButton).toHaveAttribute("download", "single-download.webp");
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("single-download.webp");
  expect(await download.failure()).toBeNull();

  await guards.assertClean();
});

test("downloads completed images as a ZIP archive", async ({ page }) => {
  const guards = installPageGuards(page);

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "zip-one.png",
      mimeType: "image/png",
      buffer: SAMPLE_PNG,
    },
    {
      name: "zip-two.png",
      mimeType: "image/png",
      buffer: SAMPLE_PNG,
    },
  ]);

  await expect(page.getByAltText("zip-one.png")).toBeVisible();
  await expect(page.getByAltText("zip-two.png")).toBeVisible();
  await page.getByRole("button", { name: "Alle starten (2)" }).click();
  await expect(page.locator('[title="zip-one.webp"]')).toBeVisible();
  await expect(page.locator('[title="zip-two.webp"]')).toBeVisible();

  await page.getByRole("button", { name: /(?:Alle downloaden|Download).*2/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Als ZIP-Archiv" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^maibach-convert-\d{4}-\d{2}-\d{2}\.zip$/);
  expect(await download.failure()).toBeNull();

  await guards.assertClean();
});

test("merges selected PDFs locally without upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await installConvertedPdfBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "contract.pdf",
      mimeType: "application/pdf",
      buffer: await createPdfFixture("contract", 1, "Private Contract"),
    },
    {
      name: "invoice.pdf",
      mimeType: "application/pdf",
      buffer: await createPdfFixture("invoice", 2, "Private Invoice"),
    },
  ]);

  await expect(page.locator('[title="contract.pdf"]')).toBeVisible();
  await expect(page.locator('[title="invoice.pdf"]')).toBeVisible();
  await page.getByRole("button", { name: "PDFs (2)" }).click();
  await expect(page.getByText(/Zusammenführen läuft lokal im Browser/i)).toBeVisible();
  await page.getByRole("button", { name: "PDFs zusammenführen" }).click();
  await expect(page.locator('[title="merged-2-pdfs.pdf"]')).toBeVisible();
  await expect(getDownloadControl(page)).toBeVisible();

  const output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(3);
  expect(output.getTitle()).toBe("Maibach Convert PDF");
  expect(output.getAuthor()).toBe("Maibach Convert");
  expect(writeRequests).toEqual([]);

  await guards.assertClean();
});

test("bundles selected images into a local PDF without upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await installConvertedPdfBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "image-a.png",
      mimeType: "image/png",
      buffer: PDF_EMBED_SAMPLE_PNG,
    },
    {
      name: "image-b.png",
      mimeType: "image/png",
      buffer: PDF_EMBED_SAMPLE_PNG,
    },
  ]);

  await expect(page.getByAltText("image-a.png")).toBeVisible();
  await expect(page.getByAltText("image-b.png")).toBeVisible();
  await page.getByRole("button", { name: "Bilder (2)" }).click();
  await page.getByRole("button", { name: "Bilder als PDF bündeln" }).click();
  await expect(page.locator('[title="images-2-pages.pdf"]')).toBeVisible();

  const output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(2);
  expect(output.getAuthor()).toBe("Maibach Convert");
  expect(writeRequests).toEqual([]);

  await guards.assertClean();
});

test("creates a searchable OCR PDF from selected images locally without upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await installConvertedPdfBlobCapture(page);
  await page.evaluate(() => {
    const win = window as Window & { __maibachTestOcr?: (file: File) => Promise<string> };
    win.__maibachTestOcr = async (file) => `LOCAL OCR TEXT ${file.name}`;
  });

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "scan-one.png",
      mimeType: "image/png",
      buffer: PDF_EMBED_SAMPLE_PNG,
    },
    {
      name: "scan-two.png",
      mimeType: "image/png",
      buffer: PDF_EMBED_SAMPLE_PNG,
    },
  ]);

  await expect(page.getByAltText("scan-one.png")).toBeVisible();
  await expect(page.getByAltText("scan-two.png")).toBeVisible();
  await page.getByRole("button", { name: "Bilder (2)" }).click();
  await page.getByRole("button", { name: "OCR-PDF erstellen" }).click();
  await expect(page.locator('[title="ocr-2-pages.pdf"]')).toBeVisible();

  const output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(2);
  expect(output.getTitle()).toBe("Maibach Convert OCR PDF");
  expect(output.getAuthor()).toBe("Maibach Convert");
  expect(writeRequests).toEqual([]);

  await guards.assertClean();
});

test("applies an image preset to a bulk selection without upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "preset-a.png",
      mimeType: "image/png",
      buffer: SAMPLE_PNG,
    },
    {
      name: "preset-b.png",
      mimeType: "image/png",
      buffer: SAMPLE_PNG,
    },
  ]);

  await expect(page.getByAltText("preset-a.png")).toBeVisible();
  await expect(page.getByAltText("preset-b.png")).toBeVisible();
  await page.getByRole("button", { name: "Bilder (2)" }).click();
  await page.getByRole("button", { name: "Kleiner JPEG" }).click();

  await expect(page.locator('[title="preset-a.jpg"]')).toBeVisible();
  await expect(page.locator('[title="preset-b.jpg"]')).toBeVisible();
  await expect(page.getByText("Qualität: max 300 KB")).toHaveCount(2);
  expect(writeRequests).toEqual([]);

  await guards.assertClean();
});

test("runs single PDF page tools locally without upload", async ({ page }) => {
  const guards = installPageGuards(page);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await installConvertedPdfBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "tools.pdf",
    mimeType: "application/pdf",
    buffer: await createPdfFixture("tools", 3, "Private Tools", [
      [200, 120],
      [240, 140],
      [280, 160],
    ]),
  });

  await expect(page.locator('[title="tools.pdf"]')).toBeVisible();

  await page.getByRole("checkbox").first().click();
  await page.getByLabel("Seitenfolge").fill("3,1");
  await page.getByRole("button", { name: "Seiten neu sortieren" }).click();
  await expect(page.locator('[title="tools-reordered.pdf"]')).toBeVisible();
  let output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(2);
  expect(output.getPages()[0].getWidth()).toBe(280);
  expect(output.getPages()[1].getWidth()).toBe(200);

  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Seiten aufteilen" }).click();
  await expect(page.locator('[title="tools-page-1.pdf"]')).toBeVisible();
  await expect(page.locator('[title="tools-page-2.pdf"]')).toBeVisible();
  await expect(page.locator('[title="tools-page-3.pdf"]')).toBeVisible();
  output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(1);

  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "90° drehen" }).click();
  await expect(page.locator('[title="tools-rotated-90.pdf"]')).toBeVisible();
  output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPages().map((pdfPage) => pdfPage.getRotation().angle)).toEqual([90, 90, 90]);

  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "PDFs komprimieren" }).click();
  await expect(page.locator('[title="tools-compressed.pdf"]')).toBeVisible();
  output = await PDFDocument.load(await readLastConvertedPdfBytes(page));
  expect(output.getPageCount()).toBe(3);
  expect(output.getAuthor()).toBe("Maibach Convert");

  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "PDF-Seiten als PNG" }).click();
  await expect(page.locator('[title="tools-page-1.png"]')).toBeVisible();
  await expect(page.locator('[title="tools-page-2.png"]')).toBeVisible();
  await expect(page.locator('[title="tools-page-3.png"]')).toBeVisible();
  const png = await readLastConvertedImageMetadata(page);
  expect(png.type).toBe("image/png");
  expect(png.width).toBeGreaterThan(0);
  expect(png.height).toBeGreaterThan(0);

  expect(writeRequests).toEqual([]);

  await guards.assertClean();
});

test("converts PNG input to supported raster image outputs with decodable dimensions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "codec smoke is covered once in the desktop project");
  const guards = installPageGuards(page);

  await page.evaluate(() => {
    const win = window as Window & {
      __convertedBlobs?: Blob[];
      __originalCreateObjectURL?: typeof URL.createObjectURL;
    };

    if (!win.__originalCreateObjectURL) {
      win.__originalCreateObjectURL = URL.createObjectURL.bind(URL);
    }

    win.__convertedBlobs = [];
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) {
        win.__convertedBlobs?.push(object);
      }
      return win.__originalCreateObjectURL?.(object) ?? "";
    };
  });

  const formats = [
    { value: "webp", extension: "webp", mimeType: "image/webp" },
    { value: "jpeg", extension: "jpg", mimeType: "image/jpeg" },
    { value: "png", extension: "png", mimeType: "image/png" },
    { value: "avif", extension: "avif", mimeType: "image/avif" },
  ] as const;

  for (const format of formats) {
    await page.locator('input[type="file"]').setInputFiles({
      name: `codec-${format.value}.png`,
      mimeType: "image/png",
      buffer: SAMPLE_PNG,
    });

    await expect(page.getByAltText(`codec-${format.value}.png`)).toBeVisible();

    if (format.value !== "webp") {
      await page.getByLabel("Zielformat").click();
      await page.getByRole("option", { name: new RegExp(`\\.${format.extension}`, "i") }).click();
    }

    await page.getByRole("button", { name: /^Start$/ }).click();
    await expect(getDownloadControl(page)).toBeVisible();

    const metadata = await page.evaluate(async (expectedType) => {
      const blobs = ((window as Window & { __convertedBlobs?: Blob[] }).__convertedBlobs ?? []).filter(
        (blob) => blob.type === expectedType,
      );
      const blob = blobs.at(-1);
      if (!blob) throw new Error(`Missing converted blob for ${expectedType}`);

      const bitmap = await createImageBitmap(blob);
      const result = {
        height: bitmap.height,
        size: blob.size,
        type: blob.type,
        width: bitmap.width,
      };
      bitmap.close();
      return result;
    }, format.mimeType);

    expect(metadata).toMatchObject({
      height: 64,
      type: format.mimeType,
      width: 64,
    });
    expect(metadata.size).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Datei entfernen" }).click();
  }

  await guards.assertClean();
});

test("applies the image watermark cleanup option", async ({ page }) => {
  const guards = installPageGuards(page);
  await page.evaluate(() => {
    const win = window as Window & {
      __convertedBlobs?: Blob[];
      __originalCreateObjectURL?: typeof URL.createObjectURL;
    };

    if (!win.__originalCreateObjectURL) {
      win.__originalCreateObjectURL = URL.createObjectURL.bind(URL);
    }

    win.__convertedBlobs = [];
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) {
        win.__convertedBlobs?.push(object);
      }
      return win.__originalCreateObjectURL?.(object) ?? "";
    };
  });

  const watermarkedPng = await createCornerWatermarkPng(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "watermark-sample.png",
    mimeType: "image/png",
    buffer: watermarkedPng,
  });

  await expect(page.getByAltText("watermark-sample.png")).toBeVisible();
  await page.getByRole("button", { name: "Qualitätseinstellungen" }).click();
  await expect(page.getByText(/Nur für eigene Bilder/)).toBeVisible();
  await expect(page.getByText(/keine vollständige Entfernungsgarantie/)).toBeVisible();
  await page.getByLabel("Watermark bereinigen").click();
  await expect(page.getByLabel("Watermark bereinigen")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Bereich wählen" }).click();
  await expect(page.getByRole("dialog")).toContainText("Bereich bereinigen");
  await expect(page.getByRole("dialog")).toContainText(/ohne vollständige Entfernungsgarantie/);
  await page.getByRole("button", { name: "Bereich verwenden" }).click();
  await expect(page.getByText(/Bereinigungsbereich/)).toBeVisible();

  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const cleanedPixel = await page.evaluate(async () => {
    const win = window as Window & { __convertedBlobs?: Blob[] };
    const blob = win.__convertedBlobs?.at(-1);
    if (!blob) throw new Error("Missing converted image blob");

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const [red, green, blue] = context.getImageData(72, 46, 1, 1).data;
    return { blue, green, red };
  });

  expect(cleanedPixel.green).toBeGreaterThan(100);
  expect(cleanedPixel.blue).toBeGreaterThan(80);
  expect(cleanedPixel.red - cleanedPixel.green).toBeLessThan(120);

  await guards.assertClean();
});

test("applies a freehand image cleanup mask", async ({ page }) => {
  const guards = installPageGuards(page);
  await page.evaluate(() => {
    const win = window as Window & {
      __convertedBlobs?: Blob[];
      __originalCreateObjectURL?: typeof URL.createObjectURL;
    };

    if (!win.__originalCreateObjectURL) {
      win.__originalCreateObjectURL = URL.createObjectURL.bind(URL);
    }

    win.__convertedBlobs = [];
    URL.createObjectURL = (object: Blob | MediaSource) => {
      if (object instanceof Blob) {
        win.__convertedBlobs?.push(object);
      }
      return win.__originalCreateObjectURL?.(object) ?? "";
    };
  });

  const watermarkedPng = await createCornerWatermarkPng(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "freehand-watermark.png",
    mimeType: "image/png",
    buffer: watermarkedPng,
  });

  await expect(page.getByAltText("freehand-watermark.png")).toBeVisible();
  await page.getByRole("button", { name: "Qualitätseinstellungen" }).click();
  await page.getByLabel("Watermark bereinigen").click();
  await page.getByRole("button", { name: "Bereich wählen" }).click();
  await page.getByRole("radio", { name: "Freihandmaske" }).click();
  await page.getByRole("slider", { name: "Pinselgröße" }).focus();
  await page.keyboard.press("End");

  const mask = page.getByTestId("cleanup-freehand-mask");
  await expect(mask).toBeVisible();
  const box = await mask.boundingBox();
  if (!box) throw new Error("Missing freehand mask bounds");

  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.72, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Maske leeren" })).toBeEnabled();
  await page.getByRole("button", { name: "Bereich verwenden" }).click();
  await expect(page.getByText(/Freihandmaske/)).toBeVisible();

  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const cleanedPixel = await page.evaluate(async () => {
    const win = window as Window & { __convertedBlobs?: Blob[] };
    const blob = win.__convertedBlobs?.at(-1);
    if (!blob) throw new Error("Missing converted image blob");

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const [red, green, blue] = context.getImageData(72, 46, 1, 1).data;
    return { blue, green, red };
  });

  expect(cleanedPixel.green).toBeGreaterThan(100);
  expect(cleanedPixel.blue).toBeGreaterThan(80);
  expect(cleanedPixel.red - cleanedPixel.green).toBeLessThan(120);

  await guards.assertClean();
});

test("keeps the image crop selection on a quick click without drag", async ({ page }) => {
  const guards = installPageGuards(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "crop-click.png",
    mimeType: "image/png",
    buffer: CROP_SAMPLE_PNG,
  });

  await expect(page.getByAltText("crop-click.png")).toBeVisible();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Bild bearbeiten");

  const previewImage = page.getByAltText("Vorschau zum Zuschneiden");
  const cropSelection = page.locator(".ReactCrop__crop-selection");
  await expect(cropSelection).toBeVisible();

  const imageBox = await previewImage.boundingBox();
  expect(imageBox).not.toBeNull();

  await page.mouse.move((imageBox?.x ?? 0) + 8, (imageBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((imageBox?.x ?? 0) + 34, (imageBox?.y ?? 0) + 34, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const imageBoxAfterDrag = await previewImage.boundingBox();
  const selectionBefore = await cropSelection.boundingBox();
  expect(imageBoxAfterDrag).not.toBeNull();
  expect(selectionBefore).not.toBeNull();
  expect(selectionBefore?.width).toBeGreaterThan(20);
  expect(selectionBefore?.height).toBeGreaterThan(20);

  await page.mouse.click((imageBoxAfterDrag?.x ?? 0) + 300, (imageBoxAfterDrag?.y ?? 0) + 180);
  await page.waitForTimeout(100);

  const selectionAfter = await cropSelection.boundingBox();
  expect(selectionAfter).not.toBeNull();
  expect(selectionAfter?.width).toBeGreaterThan((selectionBefore?.width ?? 0) * 0.8);
  expect(selectionAfter?.height).toBeGreaterThan((selectionBefore?.height ?? 0) * 0.8);
  await expect(page.locator(".ReactCrop")).not.toHaveClass(/ReactCrop--invisible-crop/);

  await guards.assertClean();
});

test("opens the video editor with trim controls for a real browser-generated WebM", async ({ page }) => {
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebm(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "trim-sample.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.locator('[title="trim-sample.webm"]')).toBeAttached();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");
  await expect(page.getByText("Video schneiden")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Position" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Ende" })).toBeVisible();

  await page.getByTitle("Play").click();
  await expect(page.getByTitle("Pause")).toBeVisible();
  await page.getByRole("button", { name: "Zurücksetzen" }).first().click();
  await page.getByRole("button", { name: "Anwenden" }).click();

  await guards.assertClean();
});

test("resizes a video through the WebCodecs path without crop or trim fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "WebCodecs resize smoke is covered once in Chromium desktop");
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebm(page);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "resize-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("resize-smoke.webm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Qualitätseinstellungen" }).click();
  await page.getByLabel("Skalierung").fill("50");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);

  expect(metadata.type).toBe("video/webm");
  expect(metadata.width).toBe(32);
  expect(metadata.height).toBe(32);
  expect(metadata.size).toBeGreaterThan(0);

  await guards.assertClean();
});

test("applies video cleanup through the degraded frame-render path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Video cleanup smoke is covered once in Chromium desktop");
  const sampleWebm = await createSampleWebm(page);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "video-cleanup-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("video-cleanup-smoke.webm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Qualitätseinstellungen" }).click();
  await expect(page.getByText(/Nur für eigene Videos/)).toBeVisible();
  await page.getByLabel("Watermark bereinigen").click();
  await page.getByRole("button", { name: "Bereich wählen" }).click();
  await expect(page.getByRole("dialog")).toContainText("Bereich bereinigen");
  await expect(page.getByRole("radio", { name: "Freihandmaske" })).toHaveCount(0);
  await page.getByRole("button", { name: "Bereich verwenden" }).click();
  await expect(page.getByText(/Bereinigungsbereich/)).toBeVisible();

  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);
  expect(metadata.type).toBe("video/webm");
  expect(metadata.width).toBe(64);
  expect(metadata.height).toBe(64);
  expect(metadata.size).toBeGreaterThan(0);
});

test("applies video crop and trim through the Mediabunny edit path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Mediabunny edit smoke is covered once in Chromium desktop");
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebm(page);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "edit-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("edit-smoke.webm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");

  const previewVideo = page.locator("video").first();
  await expect(previewVideo).toBeVisible();
  const originalDuration = await previewVideo.evaluate((video: HTMLVideoElement) => video.duration);

  const videoBox = await previewVideo.boundingBox();
  expect(videoBox).not.toBeNull();
  await page.mouse.move((videoBox?.x ?? 0) + 8, (videoBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((videoBox?.x ?? 0) + 38, (videoBox?.y ?? 0) + 38, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const cropSelection = page.locator(".ReactCrop__crop-selection");
  const selectionBox = await cropSelection.boundingBox();
  expect(selectionBox).not.toBeNull();
  expect(selectionBox?.width).toBeGreaterThan(16);
  expect(selectionBox?.width).toBeLessThan((videoBox?.width ?? 64) - 1);

  const endSlider = page.getByRole("slider", { name: "Ende" });
  await endSlider.focus();
  for (let pressCount = 0; pressCount < 4; pressCount += 1) {
    await page.keyboard.press("ArrowLeft");
  }
  await expect
    .poll(async () => Number(await endSlider.getAttribute("aria-valuenow")))
    .toBeLessThan(originalDuration - 0.1);

  await page.getByRole("button", { name: "Anwenden" }).click();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);
  expect(metadata.type).toBe("video/webm");
  expect(metadata.width).toBeGreaterThan(10);
  expect(metadata.height).toBeGreaterThan(10);
  expect(metadata.width).toBeLessThan(64);
  expect(metadata.height).toBeLessThan(64);
  expect(metadata.duration).toBeGreaterThan(0.1);
  expect(metadata.duration).toBeLessThan(originalDuration - 0.1);
  expect(metadata.size).toBeGreaterThan(0);

  await guards.assertClean();
});

test("preserves an audio track through the Mediabunny crop and trim path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Audio preservation smoke is covered once in Chromium desktop");
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebmWithAudio(page);
  const inputInspection = await inspectVideoContainer(sampleWebm);
  expect(inputInspection.videoTrackCount).toBe(1);
  expect(inputInspection.audioTrackCount).toBe(1);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "audio-edit-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("audio-edit-smoke.webm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");

  const previewVideo = page.locator("video").first();
  await expect(previewVideo).toBeVisible();
  const originalDuration = await previewVideo.evaluate((video: HTMLVideoElement) => video.duration);

  const videoBox = await previewVideo.boundingBox();
  expect(videoBox).not.toBeNull();
  await page.mouse.move((videoBox?.x ?? 0) + 8, (videoBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((videoBox?.x ?? 0) + 38, (videoBox?.y ?? 0) + 38, { steps: 5 });
  await page.mouse.up();

  const endSlider = page.getByRole("slider", { name: "Ende" });
  await endSlider.focus();
  for (let pressCount = 0; pressCount < 4; pressCount += 1) {
    await page.keyboard.press("ArrowLeft");
  }

  await page.getByRole("button", { name: "Anwenden" }).click();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const outputInspection = await inspectVideoContainer(await readLastConvertedVideoBytes(page));
  expect(outputInspection.videoTrackCount).toBe(1);
  expect(outputInspection.audioTrackCount).toBe(1);
  expect(outputInspection.duration).toBeGreaterThan(0.1);
  expect(outputInspection.duration).toBeLessThan(originalDuration - 0.1);

  await guards.assertClean();
});

test("writes edited video to MP4 through the Mediabunny path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "MP4 edit smoke is covered once in Chromium desktop");
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebmWithAudio(page);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "mp4-edit-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("mp4-edit-smoke.webm", { exact: true })).toBeVisible();
  await page.getByLabel("Zielformat").click();
  await page.getByRole("option", { name: /\.mp4/i }).click();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");

  const previewVideo = page.locator("video").first();
  await expect(previewVideo).toBeVisible();
  const videoBox = await previewVideo.boundingBox();
  expect(videoBox).not.toBeNull();
  await page.mouse.move((videoBox?.x ?? 0) + 8, (videoBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((videoBox?.x ?? 0) + 42, (videoBox?.y ?? 0) + 42, { steps: 5 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Anwenden" }).click();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);
  expect(metadata.type).toBe("video/mp4");
  expect(metadata.width).toBeGreaterThan(10);
  expect(metadata.width).toBeLessThan(64);

  const outputInspection = await inspectVideoContainer(await readLastConvertedVideoBytes(page));
  expect(outputInspection.videoTrackCount).toBe(1);
  expect(outputInspection.audioTrackCount).toBe(1);

  await guards.assertClean();
});

test("falls back cleanly for MP4 input when WebCodecs cannot decode the source", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "MP4 input fallback smoke is covered once in Chromium desktop");
  const mp4RecordingSupported = await page.evaluate(
    () => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/mp4"),
  );
  test.skip(!mp4RecordingSupported, "Browser cannot generate a local MP4 fixture");

  const sampleMp4 = await createSampleMp4(page);
  const inputInspection = await inspectVideoContainer(sampleMp4);
  expect(inputInspection.videoTrackCount).toBe(1);

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "mp4-input-smoke.mp4",
    mimeType: "video/mp4",
    buffer: sampleMp4,
  });

  await expect(page.getByText(/mp4-input-smoke\.mp4/)).toBeVisible();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");

  const previewVideo = page.locator("video").first();
  await expect(previewVideo).toBeVisible();
  const originalDuration = await previewVideo.evaluate((video: HTMLVideoElement) => video.duration);
  const videoBox = await previewVideo.boundingBox();
  expect(videoBox).not.toBeNull();
  await page.mouse.move((videoBox?.x ?? 0) + 8, (videoBox?.y ?? 0) + 8);
  await page.mouse.down();
  await page.mouse.move((videoBox?.x ?? 0) + 38, (videoBox?.y ?? 0) + 38, { steps: 5 });
  await page.mouse.up();

  const endSlider = page.getByRole("slider", { name: "Ende" });
  await endSlider.focus();
  for (let pressCount = 0; pressCount < 4; pressCount += 1) {
    await page.keyboard.press("ArrowLeft");
  }

  await page.getByRole("button", { name: "Anwenden" }).click();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);
  expect(metadata.type).toBe("video/webm");

  const outputInspection = await inspectVideoContainer(await readLastConvertedVideoBytes(page));
  expect(outputInspection.videoTrackCount).toBe(1);
  expect(outputInspection.duration).toBeGreaterThan(0.1);
  expect(outputInspection.duration).toBeLessThan(originalDuration - 0.1);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("rotates edited video through the Mediabunny path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Rotation smoke is covered once in Chromium desktop");
  const guards = installPageGuards(page);
  const sampleWebm = await createSampleWebm(page, { width: 80, height: 48 });

  await installConvertedVideoBlobCapture(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "rotate-smoke.webm",
    mimeType: "video/webm",
    buffer: sampleWebm,
  });

  await expect(page.getByText("rotate-smoke.webm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zuschneiden" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Video bearbeiten");
  const widthInput = page.getByRole("spinbutton", { name: "Breite", exact: true });
  const heightInput = page.getByRole("spinbutton", { name: "Höhe", exact: true });
  await expect.poll(async () => Number(await widthInput.inputValue())).toBeGreaterThan(0);
  await expect.poll(async () => Number(await heightInput.inputValue())).toBeGreaterThan(0);
  const originalWidth = Number(await widthInput.inputValue());
  const originalHeight = Number(await heightInput.inputValue());
  await page.getByRole("button", { name: "Rechts drehen" }).click();
  await expect(page.getByText("90°")).toBeVisible();
  await expect(widthInput).toHaveValue(String(originalHeight));
  await expect(heightInput).toHaveValue(String(originalWidth));

  await page.getByRole("button", { name: "Anwenden" }).click();
  await expect(page.getByText("Gedreht")).toBeVisible();
  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(getDownloadControl(page)).toBeVisible();

  const metadata = await readLastConvertedVideoMetadata(page);
  expect(metadata.type).toBe("video/webm");
  expect(metadata.width).toBe(toEvenDimension(originalHeight));
  expect(metadata.height).toBe(toEvenDimension(originalWidth));

  await guards.assertClean();
});
