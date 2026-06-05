import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return entry.isFile() && /\.(css|ts|tsx)$/.test(path) ? [path] : [];
  });

describe("custom SVG system", () => {
  it("keeps source icons on the custom media-convert iconset", () => {
    const sourceFiles = collectSourceFiles(join(repoRoot, "src"))
      .filter((path) => !path.includes("/src/test/"));

    const filesWithLucideImports = sourceFiles.filter((path) =>
      readFileSync(path, "utf8").includes("lucide-react"),
    );

    expect(filesWithLucideImports).toEqual([]);
  });

  it("does not keep decorative SVG data URLs in CSS", () => {
    const cssFiles = collectSourceFiles(join(repoRoot, "src"))
      .filter((path) => path.endsWith(".css"));

    const filesWithSvgDataUrls = cssFiles.filter((path) =>
      readFileSync(path, "utf8").includes("data:image/svg"),
    );

    expect(filesWithSvgDataUrls).toEqual([]);
  });

  it("keeps logo SVG assets aligned with the Maibach Systems reference mark", () => {
    const assetDir = join(repoRoot, "public/assets");
    const logoMarkWhite = readFileSync(join(assetDir, "logo-mark-white.svg"), "utf8");
    const logoMark = readFileSync(join(assetDir, "logo-mark.svg"), "utf8");
    const logoFullWhite = readFileSync(join(assetDir, "logo-full-white.svg"), "utf8");
    const logoFull = readFileSync(join(assetDir, "logo-full.svg"), "utf8");

    for (const svg of [logoMarkWhite, logoMark]) {
      expect(svg).toContain('viewBox="108.9375 10.125 157 342.125"');
      expect(svg).toContain("6.1875 -160.625");
      expect(svg).toContain("39.546875 -154.65625");
    }

    for (const svg of [logoFullWhite, logoFull]) {
      expect(svg).toContain('viewBox="3.3125 60.3125 176.4375 59.6875"');
      expect(svg).toContain("1.03125 -26.6875");
      expect(svg).toContain("6.5625 -25.6875");
      expect(svg).toContain("35.557577");
    }
  });

  it("serves a custom SVG favicon with PNG fallbacks", () => {
    const layout = readFileSync(join(repoRoot, "src/layouts/BaseLayout.astro"), "utf8");
    const faviconSvg = readFileSync(join(repoRoot, "public/favicon.svg"), "utf8");
    const faviconPng = readFileSync(join(repoRoot, "public/favicon.png"));
    const appleTouchIcon = readFileSync(join(repoRoot, "public/apple-touch-icon.png"));

    expect(layout).toContain('type="image/svg+xml" href="/favicon.svg"');
    expect(layout).toContain('type="image/png" href="/favicon.png"');
    expect(layout).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(faviconSvg).toContain("6.187-160.625");
    expect(faviconSvg).toContain("39.547-154.656");
    expect(faviconSvg).not.toContain("matrix(");
    expect(faviconSvg.length).toBeLessThan(1_500);
    expect(faviconPng.length).toBeGreaterThan(1_000);
    expect(appleTouchIcon.length).toBeGreaterThan(1_000);
  });
});
