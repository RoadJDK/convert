import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifestPath = `${process.cwd()}/public/manifest.webmanifest`;
const serviceWorkerPath = `${process.cwd()}/public/service-worker.js`;
const offlinePath = `${process.cwd()}/public/offline.html`;

describe("PWA offline assets", () => {
  it("defines an installable app manifest", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(manifest).toMatchObject({
      name: "Maibach Convert",
      short_name: "Convert",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "rgb(250, 250, 250)",
      background_color: "rgb(250, 250, 250)",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/apple-touch-icon.png", sizes: "180x180" }),
        expect.objectContaining({ src: "/favicon.png", sizes: "32x32" }),
      ]),
    );
  });

  it("keeps the service worker scoped to GET app-shell resources", () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
    const offlineHtml = readFileSync(offlinePath, "utf8");

    expect(serviceWorker).toContain('request.method !== "GET"');
    expect(serviceWorker).toContain("maibach-convert-shell-v");
    expect(serviceWorker).toContain("/offline.html");
    expect(offlineHtml).toContain("Maibach Convert ist offline");
  });
});
