import { describe, expect, it } from "vitest";

import { createRectangularInpaintingMask, createStrokeInpaintingMask, inpaintMaskedPixels } from "@/lib/localInpainting";

function createFixtureImage(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = x < Math.floor(width / 2) ? 20 : 220;
      data[offset + 1] = y * 30;
      data[offset + 2] = 80;
      data[offset + 3] = 255;
    }
  }

  return { data, width, height };
}

function pixelAt(image: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

describe("local inpainting", () => {
  it("fills a rectangular mask from surrounding unmasked pixels without changing the source border", () => {
    const source = createFixtureImage(7, 5);
    const mask = createRectangularInpaintingMask(
      { width: source.width, height: source.height },
      [{ x: 2, y: 1, width: 3, height: 3 }],
    );
    const beforeTopLeft = pixelAt(source, 0, 0);
    const beforeCenter = pixelAt(source, 3, 2);

    source.data[(2 * source.width + 3) * 4] = 255;
    source.data[(2 * source.width + 3) * 4 + 1] = 0;
    source.data[(2 * source.width + 3) * 4 + 2] = 0;

    const result = inpaintMaskedPixels(source, mask);

    expect(result.report).toMatchObject({
      method: "local-diffusion-inpaint",
      maskedPixels: 9,
      resolvedPixels: 9,
    });
    expect(pixelAt(result.image, 0, 0)).toEqual(beforeTopLeft);
    expect(pixelAt(result.image, 3, 2)).not.toEqual(beforeCenter);
    expect(pixelAt(result.image, 3, 2)[0]).toBeGreaterThan(20);
    expect(pixelAt(result.image, 3, 2)[0]).toBeLessThan(220);
    expect(pixelAt(result.image, 3, 2)[3]).toBe(255);
  });

  it("clips masks to the image bounds", () => {
    const mask = createRectangularInpaintingMask(
      { width: 4, height: 3 },
      [{ x: -2, y: 1, width: 4, height: 4 }],
    );

    expect(Array.from(mask)).toEqual([
      0, 0, 0, 0,
      1, 1, 0, 0,
      1, 1, 0, 0,
    ]);
  });

  it("rasterizes normalized freehand strokes into a brush mask", () => {
    const mask = createStrokeInpaintingMask(
      { width: 10, height: 10 },
      [{
        brushRadius: 0.15,
        points: [
          { x: 0.2, y: 0.5 },
          { x: 0.8, y: 0.5 },
        ],
      }],
    );

    expect(mask[5 * 10 + 2]).toBe(1);
    expect(mask[5 * 10 + 5]).toBe(1);
    expect(mask[5 * 10 + 8]).toBe(1);
    expect(mask[1 * 10 + 5]).toBe(0);
  });

  it("replaces a saturated corner watermark sample when the mask includes the full mark", () => {
    const width = 96;
    const height = 64;
    const image = createFixtureImage(width, height);

    for (let y = 36; y < 58; y += 1) {
      for (let x = 60; x < 92; x += 1) {
        const offset = (y * width + x) * 4;
        image.data[offset] = 225;
        image.data[offset + 1] = 18;
        image.data[offset + 2] = 47;
      }
    }

    const mask = createRectangularInpaintingMask(
      { width, height },
      [{ x: 53, y: 32, width: 41, height: 28 }],
    );

    const result = inpaintMaskedPixels(image, mask);
    const [red, green, blue] = pixelAt(result.image, 72, 46);

    expect(green).toBeGreaterThan(100);
    expect(blue).toBeGreaterThan(70);
    expect(red - green).toBeLessThan(120);
  });

  it("replaces a saturated corner watermark sample with the automatic corner mask", () => {
    const width = 96;
    const height = 64;
    const image = createFixtureImage(width, height);

    for (let y = 36; y < 58; y += 1) {
      for (let x = 60; x < 92; x += 1) {
        const offset = (y * width + x) * 4;
        image.data[offset] = 225;
        image.data[offset + 1] = 18;
        image.data[offset + 2] = 47;
      }
    }

    const mask = createRectangularInpaintingMask(
      { width, height },
      [{ x: 60, y: 35, width: 32, height: 24 }],
    );

    const result = inpaintMaskedPixels(image, mask);
    const [red, green, blue] = pixelAt(result.image, 72, 46);

    expect(green).toBeGreaterThan(100);
    expect(blue).toBeGreaterThan(70);
    expect(red - green).toBeLessThan(120);
  });
});
