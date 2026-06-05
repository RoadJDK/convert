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
  cqLevel: number;
  cqAlphaLevel: number;
  speed: number;
  subsample: number;
  chromaDeltaQ: boolean;
  sharpness: number;
  tune: number;
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

  // AVIF uses cqLevel: 0-63 (0 = lossless, 63 = worst) - inverse relationship
  // Map quality 0-100 to cqLevel 63-0
  const cqLevel = Math.round(63 - (quality0to100 / 100) * 63);

  // Encode options following @jsquash/avif defaults
  const encodeOptions = {
    cqLevel,
    cqAlphaLevel: -1, // Use same quality for alpha
    speed: 6, // 0-10, higher is faster but larger files
    subsample: 1, // YUV420
    chromaDeltaQ: false,
    sharpness: 0,
    tune: 0, // PSNR
  };

  // Call the WASM encoder directly
  const output = avifModule.encode(
    new Uint8Array(imageData.data.buffer),
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
