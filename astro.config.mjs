import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

const srcPath = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  vite: {
    resolve: {
      alias: [
        {
          find: "onnxruntime-web/webgpu",
          replacement: srcPath("./src/lib/onnxruntimeWebgpuDisabled.ts"),
        },
        {
          find: "onnxruntime-web",
          replacement: srcPath("./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"),
        },
        {
          find: "@",
          replacement: srcPath("./src"),
        },
      ],
    },
    optimizeDeps: {
      exclude: [
        "@jsquash/avif",
        "@jsquash/oxipng",
        "@jsquash/png",
        "@jsquash/webp",
        "onnxruntime-web",
      ],
    },
  },
});
