#!/usr/bin/env node

const usage = `Usage:
  node scripts/measure-background-mask-quality.mjs --candidate output.webp --reference reference.png [options]

Options:
  --alpha-threshold <0-255>  Alpha value counted as foreground. Default: 128
  --align <canvas|alpha-bbox> Compare the full canvas or foreground alpha bounds. Default: canvas
  --diff <path>             Write a PNG diff overlay. Red = missing, blue = extra, green = overlap
  --json                    Print machine-readable JSON

The reference image is resized to the candidate dimensions before comparing alpha masks.
`;

const parseArgs = (argv) => {
  const args = {
    align: "canvas",
    alphaThreshold: 128,
    candidate: "",
    diff: "",
    json: false,
    reference: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--candidate" && next) {
      args.candidate = next;
      index += 1;
      continue;
    }
    if (arg === "--reference" && next) {
      args.reference = next;
      index += 1;
      continue;
    }
    if (arg === "--alpha-threshold" && next) {
      args.alphaThreshold = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--align" && next) {
      args.align = next;
      index += 1;
      continue;
    }
    if (arg === "--diff" && next) {
      args.diff = next;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (!args.candidate || !args.reference) {
    throw new Error("Both --candidate and --reference are required.");
  }
  if (!Number.isFinite(args.alphaThreshold) || args.alphaThreshold < 0 || args.alphaThreshold > 255) {
    throw new Error("--alpha-threshold must be a number from 0 to 255.");
  }
  if (!["canvas", "alpha-bbox"].includes(args.align)) {
    throw new Error("--align must be either canvas or alpha-bbox.");
  }

  return args;
};

const loadSharp = async () => {
  try {
    const sharp = await import("sharp");
    return sharp.default;
  } catch (error) {
    throw new Error(
      "This script requires sharp. Install project dependencies before running it.",
      { cause: error },
    );
  }
};

const readRgba = async (sharp, filePath, size) => {
  let pipeline = sharp(filePath, { animated: false }).rotate().ensureAlpha();
  if (size) {
    pipeline = pipeline.resize(size.width, size.height, { fit: "fill" });
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return {
    data,
    height: info.height,
    width: info.width,
  };
};

const findAlphaBounds = (image, threshold) => {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    height: maxY - minY + 1,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX + 1,
  };
};

const cropRgba = (image, bounds) => {
  const cropped = Buffer.alloc(bounds.width * bounds.height * 4);

  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.minY + y) * image.width + bounds.minX) * 4;
    const targetStart = y * bounds.width * 4;
    image.data.copy(cropped, targetStart, sourceStart, sourceStart + bounds.width * 4);
  }

  return {
    data: cropped,
    height: bounds.height,
    width: bounds.width,
  };
};

const alignImage = (image, alignment, threshold) => {
  if (alignment === "canvas") {
    return { bounds: null, image };
  }

  const bounds = findAlphaBounds(image, threshold);
  if (!bounds) {
    return { bounds: null, image };
  }

  return {
    bounds,
    image: cropRgba(image, bounds),
  };
};

const resizeRgba = async (sharp, image, size) => {
  if (image.width === size.width && image.height === size.height) {
    return image;
  }

  const { data, info } = await sharp(image.data, {
    raw: {
      channels: 4,
      height: image.height,
      width: image.width,
    },
  }).resize(size.width, size.height, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });

  return {
    data,
    height: info.height,
    width: info.width,
  };
};

const roundMetric = (value) => Number(value.toFixed(6));

const measureMasks = (candidate, reference, threshold, details = {}) => {
  const totalPixels = candidate.width * candidate.height;
  let candidateForeground = 0;
  let referenceForeground = 0;
  let intersection = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4;
    const candidateIsForeground = candidate.data[offset + 3] > threshold;
    const referenceIsForeground = reference.data[offset + 3] > threshold;

    if (candidateIsForeground) candidateForeground += 1;
    if (referenceIsForeground) referenceForeground += 1;
    if (candidateIsForeground && referenceIsForeground) intersection += 1;
    if (candidateIsForeground && !referenceIsForeground) falsePositive += 1;
    if (!candidateIsForeground && referenceIsForeground) falseNegative += 1;
  }

  const union = intersection + falsePositive + falseNegative;
  const referenceBackground = totalPixels - referenceForeground;

  return {
    alphaThreshold: threshold,
    ...details,
    candidateForeground,
    dimensions: {
      height: candidate.height,
      width: candidate.width,
    },
    falseNegative,
    falseNegativeRate: roundMetric(falseNegative / Math.max(referenceForeground, 1)),
    falsePositive,
    falsePositiveRate: roundMetric(falsePositive / Math.max(referenceBackground, 1)),
    intersection,
    iou: roundMetric(intersection / Math.max(union, 1)),
    precision: roundMetric(intersection / Math.max(intersection + falsePositive, 1)),
    recall: roundMetric(intersection / Math.max(intersection + falseNegative, 1)),
    referenceForeground,
    totalPixels,
    union,
  };
};

const writeDiff = async (sharp, filePath, candidate, reference, threshold) => {
  const totalPixels = candidate.width * candidate.height;
  const diff = Buffer.alloc(totalPixels * 4);

  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const offset = pixel * 4;
    const candidateIsForeground = candidate.data[offset + 3] > threshold;
    const referenceIsForeground = reference.data[offset + 3] > threshold;

    if (candidateIsForeground && referenceIsForeground) {
      diff[offset] = 80;
      diff[offset + 1] = 190;
      diff[offset + 2] = 110;
      diff[offset + 3] = 180;
    } else if (candidateIsForeground) {
      diff[offset] = 70;
      diff[offset + 1] = 130;
      diff[offset + 2] = 255;
      diff[offset + 3] = 220;
    } else if (referenceIsForeground) {
      diff[offset] = 255;
      diff[offset + 1] = 70;
      diff[offset + 2] = 70;
      diff[offset + 3] = 220;
    }
  }

  await sharp(diff, {
    raw: {
      channels: 4,
      height: candidate.height,
      width: candidate.width,
    },
  }).png().toFile(filePath);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sharp = await loadSharp();
  const threshold = Math.round(args.alphaThreshold);
  const rawCandidate = await readRgba(sharp, args.candidate);
  const rawReference = await readRgba(sharp, args.reference);
  const alignedCandidate = alignImage(rawCandidate, args.align, threshold);
  const alignedReference = alignImage(rawReference, args.align, threshold);
  const candidate = alignedCandidate.image;
  const reference = await resizeRgba(sharp, alignedReference.image, candidate);
  const metrics = measureMasks(candidate, reference, threshold, {
    alignment: args.align,
    candidateAlphaBounds: alignedCandidate.bounds,
    referenceAlphaBounds: alignedReference.bounds,
  });

  if (args.diff) {
    await writeDiff(sharp, args.diff, candidate, reference, metrics.alphaThreshold);
  }

  if (args.json) {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }

  console.log(`Alpha mask quality: ${args.candidate}`);
  console.log(`Reference: ${args.reference}`);
  console.log(`Size: ${metrics.dimensions.width}x${metrics.dimensions.height}`);
  console.log(`IoU: ${metrics.iou}`);
  console.log(`Precision: ${metrics.precision}`);
  console.log(`Recall: ${metrics.recall}`);
  console.log(`False negatives: ${metrics.falseNegative} (${metrics.falseNegativeRate})`);
  console.log(`False positives: ${metrics.falsePositive} (${metrics.falsePositiveRate})`);
  if (args.diff) console.log(`Diff overlay: ${args.diff}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
