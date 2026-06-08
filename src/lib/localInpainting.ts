export type PixelImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type InpaintingMask = Uint8Array;

export type InpaintingReport = {
  method: "local-diffusion-inpaint";
  maskedPixels: number;
  resolvedPixels: number;
  iterations: number;
};

export type InpaintingResult = {
  image: PixelImageData;
  report: InpaintingReport;
};

export type InpaintingRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedMaskPoint = {
  x: number;
  y: number;
};

export type NormalizedMaskStroke = {
  points: NormalizedMaskPoint[];
  brushRadius: number;
};

type InpaintingOptions = {
  maxIterations?: number;
  radius?: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function offsetOf(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

export function createRectangularInpaintingMask(
  size: { width: number; height: number },
  rects: InpaintingRect[],
): InpaintingMask {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const mask = new Uint8Array(width * height);

  for (const rect of rects) {
    const left = clamp(Math.floor(rect.x), 0, width);
    const top = clamp(Math.floor(rect.y), 0, height);
    const right = clamp(Math.ceil(rect.x + rect.width), 0, width);
    const bottom = clamp(Math.ceil(rect.y + rect.height), 0, height);

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

function fillBrush(mask: InpaintingMask, width: number, height: number, centerX: number, centerY: number, radius: number): void {
  const safeRadius = Math.max(1, radius);
  const left = clamp(Math.floor(centerX - safeRadius), 0, width - 1);
  const top = clamp(Math.floor(centerY - safeRadius), 0, height - 1);
  const right = clamp(Math.ceil(centerX + safeRadius), left, width - 1);
  const bottom = clamp(Math.ceil(centerY + safeRadius), top, height - 1);
  const radiusSquared = safeRadius * safeRadius;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        mask[y * width + x] = 1;
      }
    }
  }
}

function denormalizePoint(point: NormalizedMaskPoint, width: number, height: number): { x: number; y: number } {
  return {
    x: clamp(point.x, 0, 1) * Math.max(0, width - 1),
    y: clamp(point.y, 0, 1) * Math.max(0, height - 1),
  };
}

export function createStrokeInpaintingMask(
  size: { width: number; height: number },
  strokes: NormalizedMaskStroke[],
): InpaintingMask {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const mask = new Uint8Array(width * height);

  for (const stroke of strokes) {
    const radius = clamp(stroke.brushRadius, 0.001, 0.5) * Math.min(width, height);
    const points = stroke.points.map((point) => denormalizePoint(point, width, height));

    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[index - 1] ?? current;
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.5)));

      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        fillBrush(
          mask,
          width,
          height,
          previous.x + (current.x - previous.x) * progress,
          previous.y + (current.y - previous.y) * progress,
          radius,
        );
      }
    }
  }

  return mask;
}

export function inpaintMaskedPixels(
  source: PixelImageData,
  mask: InpaintingMask,
  options: InpaintingOptions = {},
): InpaintingResult {
  const width = Math.max(1, Math.round(source.width));
  const height = Math.max(1, Math.round(source.height));
  const expectedPixels = width * height;

  if (source.data.length !== expectedPixels * 4) {
    throw new Error("Image data size does not match width and height.");
  }

  if (mask.length !== expectedPixels) {
    throw new Error("Inpainting mask size does not match image size.");
  }

  const output = new Uint8ClampedArray(source.data);
  const unresolved = new Uint8Array(mask);
  let unresolvedPixels: number[] = [];

  for (let index = 0; index < unresolved.length; index += 1) {
    if (unresolved[index]) {
      unresolvedPixels.push(index);
    }
  }

  const maskedPixels = unresolvedPixels.length;
  const maxIterations = Math.max(1, Math.round(options.maxIterations ?? Math.max(width, height)));
  const radius = Math.max(1, Math.round(options.radius ?? 1));
  let resolvedPixels = 0;
  let iterations = 0;

  for (let iteration = 0; iteration < maxIterations && unresolvedPixels.length > 0; iteration += 1) {
    const pendingWrites: Array<{ x: number; y: number; rgba: [number, number, number, number] }> = [];
    const nextUnresolvedPixels: number[] = [];

    for (const pixelIndex of unresolvedPixels) {
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let weight = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;

          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (unresolved[ny * width + nx]) continue;

          const distance = Math.sqrt(dx * dx + dy * dy);
          const neighborWeight = 1 / Math.max(1, distance);
          const neighborOffset = offsetOf(width, nx, ny);

          red += output[neighborOffset] * neighborWeight;
          green += output[neighborOffset + 1] * neighborWeight;
          blue += output[neighborOffset + 2] * neighborWeight;
          alpha += output[neighborOffset + 3] * neighborWeight;
          weight += neighborWeight;
        }
      }

      if (weight > 0) {
        pendingWrites.push({
          x,
          y,
          rgba: [
            red / weight,
            green / weight,
            blue / weight,
            alpha / weight,
          ],
        });
      } else {
        nextUnresolvedPixels.push(pixelIndex);
      }
    }

    if (pendingWrites.length === 0) break;

    for (const write of pendingWrites) {
      const offset = offsetOf(width, write.x, write.y);
      output[offset] = write.rgba[0];
      output[offset + 1] = write.rgba[1];
      output[offset + 2] = write.rgba[2];
      output[offset + 3] = write.rgba[3];
      unresolved[write.y * width + write.x] = 0;
    }

    resolvedPixels += pendingWrites.length;
    unresolvedPixels = nextUnresolvedPixels;
    iterations = iteration + 1;
  }

  return {
    image: {
      data: output,
      width,
      height,
    },
    report: {
      method: "local-diffusion-inpaint",
      maskedPixels,
      resolvedPixels,
      iterations,
    },
  };
}
