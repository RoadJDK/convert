import encodeWebp, { init as initWebpEncode } from "@jsquash/webp/encode";
import optimisePng, { init as initOxipng } from "@jsquash/oxipng/optimise";

// Force Vite to bundle/serve the WASM files and give us stable URLs.
// This prevents runtime fetching of wrong paths (HTML/JS instead of .wasm),
// which manifests as: "module doesn't start with '\0asm'".
import webpEncWasmUrl from "@jsquash/webp/codec/enc/webp_enc.wasm?url";
import webpEncSimdWasmUrl from "@jsquash/webp/codec/enc/webp_enc_simd.wasm?url";
// AVIF: Use single-thread version to avoid Vite worker bundling issues
import avifEncWasmUrl from "@jsquash/avif/codec/enc/avif_enc.wasm?url";
import oxipngWasmUrl from "@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url";

let webpReady: Promise<void> | null = null;
let avifReady: Promise<void> | null = null;
let avifModule: AvifEncoderModule | null = null;
let oxipngReady: Promise<void> | null = null;

type AvifEncodeOptions = {
  quality: number;
  qualityAlpha: number;
  denoiseLevel: number;
  tileRowsLog2: number;
  tileColsLog2: number;
  speed: number;
  subsample: number;
  chromaDeltaQ: boolean;
  sharpness: number;
  enableSharpYUV: boolean;
  tune: number;
  bitDepth: number;
};

type AvifEncoderModule = {
  encode: (
    data: Uint8Array,
    width: number,
    height: number,
    options: AvifEncodeOptions,
  ) => Uint8Array | null;
};

type AvifEncoderFactory = (options: {
  locateFile: (path: string) => string;
}) => Promise<AvifEncoderModule>;

async function ensureWebpReady() {
  if (webpReady) return webpReady;
  webpReady = (async () => {
    await initWebpEncode({
      locateFile: (path: string) => {
        // encode.js chooses SIMD module when available.
        if (path.endsWith("webp_enc_simd.wasm")) return webpEncSimdWasmUrl;
        if (path.endsWith("webp_enc.wasm")) return webpEncWasmUrl;
        // Defensive fallback
        return webpEncWasmUrl;
      },
    });
  })();
  return webpReady;
}

async function ensureAvifReady() {
  if (avifReady) return avifReady;
  avifReady = (async () => {
    // Dynamically import the single-thread AVIF encoder to avoid worker bundling issues
    const avifEncoderModule = await import("@jsquash/avif/codec/enc/avif_enc.js");
    const avifEncoder = avifEncoderModule.default as AvifEncoderFactory;

    // Initialize with locateFile to use our bundled WASM
    avifModule = await avifEncoder({
      locateFile: (path: string) => {
        if (path.endsWith("avif_enc.wasm")) return avifEncWasmUrl;
        return avifEncWasmUrl;
      },
    });
  })();
  return avifReady;
}

async function ensureOxipngReady() {
  if (oxipngReady) return oxipngReady;
  oxipngReady = (async () => {
    // wasm-bindgen init accepts a URL/string/Response/etc.
    await initOxipng(oxipngWasmUrl);
  })();
  return oxipngReady;
}

export async function encodeWebpWasm(imageData: ImageData, quality0to100: number) {
  await ensureWebpReady();
  return encodeWebp(imageData, { quality: quality0to100 });
}

/**
 * Encode ImageData to AVIF format using WASM.
 * Quality range: 0-100 (0 = worst, 100 = best/lossless)
 * Note: AVIF encoding is slower than WebP but produces smaller files.
 */
export async function encodeAvifWasm(imageData: ImageData, quality0to100: number) {
  await ensureAvifReady();

  if (!avifModule) {
    throw new Error("AVIF encoder not initialized");
  }

  const quality = Math.min(100, Math.max(0, Math.round(quality0to100)));
  const encodeOptions = {
    quality,
    qualityAlpha: -1,
    denoiseLevel: 0,
    tileRowsLog2: 0,
    tileColsLog2: 0,
    speed: 6,
    subsample: 1,
    chromaDeltaQ: false,
    sharpness: 0,
    enableSharpYUV: false,
    tune: 0,
    bitDepth: 8,
  };

  // Call the WASM encoder directly
  const output = avifModule.encode(
    new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    imageData.width,
    imageData.height,
    encodeOptions
  );

  if (!output) {
    throw new Error("AVIF encoding failed");
  }

  return output.buffer;
}

export async function optimisePngWasm(pngBuffer: ArrayBuffer, level: number) {
  await ensureOxipngReady();
  return optimisePng(pngBuffer, { level });
}
