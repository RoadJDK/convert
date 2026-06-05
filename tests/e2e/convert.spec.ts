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

  await expect
    .poll(async () => (await dropZone.boundingBox())?.height ?? 0, {
      timeout: 2_000,
    })
    .toBeLessThan((expandedBox?.height ?? 0) - 90);

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
