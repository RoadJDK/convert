import encodeWebp, { init as initWebpEncode } from "@jsquash/webp/encode";
import optimisePng, { init as initOxipng } from "@jsquash/oxipng/optimise";

// Force Vite to bundle/serve the WASM files and give us stable URLs.
// This prevents runtime fetching of wrong paths (HTML/JS instead of .wasm),
// which manifests as: "module doesn't start with '\0asm'".
import webpEncWasmUrl from "@jsquash/webp/codec/enc/webp_enc.wasm?url";
import webpEncSimdWasmUrl from "@jsquash/webp/codec/enc/webp_enc_simd.wasm?url";
import oxipngWasmUrl from "@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url";

let webpReady: Promise<void> | null = null;
let oxipngReady: Promise<void> | null = null;

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

export async function optimisePngWasm(pngBuffer: ArrayBuffer, level: number) {
  await ensureOxipngReady();
  return optimisePng(pngBuffer, { level });
}
