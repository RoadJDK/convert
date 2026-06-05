import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
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
