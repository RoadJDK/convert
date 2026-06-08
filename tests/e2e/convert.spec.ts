import { expect, test, type Page } from "@playwright/test";

const SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAdklEQVR4nO3QQQ3AIADAQMAKljLDf5O43Hgw7KUXsHfvewCx78sBEA0gGkA0gGgA0QCiAUQDiAYQDSAaQDSAaADRANIAogFEA4gGEA0gGkA0gGgA0QCiAUQDiAYQDSAaQDSAaADRANIAogFEA4gGEA0gGkA0gGgA0QCiAUQDiH4OawLYl/8YWwAAAABJRU5ErkJggg==",
  "base64",
);

const CROP_SAMPLE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAZAAAADwCAIAAAChXqV1AAACZUlEQVR42u3UQQ0AAAjEsHOJJ/zhBxuQNKmCPZbpAnghEgCGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgqAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWCoAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWgGEBhgVgWACGBRgWgGEBGBZgWACGBWBYgGEBGBZgWACGBWBYgGEBGBaAYQGGBWBYAIYFGBaAYQEYFmBYAIYFYFiAYQEYFoBhAYYFYFgAhgUYFoBhARgWYFgAhgVgWIBhARgWYFgAhgVgWIBhARgWgGEBhgVwywIz0b+QMT378QAAAABJRU5ErkJggg==",
  "base64",
);

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

const createSampleWebm = async (page: Page): Promise<Buffer> => {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
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
  });

  return Buffer.from(bytes);
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
  await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();

  const stats = await page.evaluate(() => localStorage.getItem("maibach_convert_stats"));
  expect(stats).toContain('"imagesConverted":1');

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
    await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();

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

  await page.locator('input[type="file"]').setInputFiles({
    name: "watermark-sample.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  await expect(page.getByAltText("watermark-sample.png")).toBeVisible();
  await page.getByRole("button", { name: "Qualitätseinstellungen" }).click();
  await page.getByLabel("Watermark entfernen").click();
  await expect(page.getByLabel("Watermark entfernen")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^Start$/ }).click();
  await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();

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
