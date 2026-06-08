import { describe, expect, it } from "vitest";
import {
  detectFileType,
  getDefaultOutputFormat,
  getOutputFormatOptions,
  getOutputMimeTypeForFormat,
} from "@/lib/formatCapabilities";
import { getFileType } from "@/types/converter";

describe("format capabilities", () => {
  it("detects SVG images from MIME type and file extension fallback", () => {
    const svgWithMime = new File(["<svg />"], "icon.svg", { type: "image/svg+xml" });
    const svgWithoutMime = new File(["<svg />"], "icon.svg", { type: "" });

    expect(detectFileType(svgWithMime)).toBe("image");
    expect(detectFileType(svgWithoutMime)).toBe("image");
    expect(getFileType(svgWithoutMime)).toBe("image");
  });

  it("detects HEIC, HEIF, and TIFF images from MIME type and file extension fallback", () => {
    expect(detectFileType(new File(["x"], "camera.heic", { type: "" }))).toBe("image");
    expect(detectFileType(new File(["x"], "camera.bin", { type: "image/heif" }))).toBe("image");
    expect(detectFileType(new File(["x"], "scan.tiff", { type: "" }))).toBe("image");
    expect(getFileType(new File(["x"], "scan.bin", { type: "image/tiff" }))).toBe("image");
  });

  it("keeps output format facts scoped by file type", () => {
    expect(getDefaultOutputFormat("image")).toBe("webp");
    expect(getDefaultOutputFormat("video")).toBe("webm");
    expect(getDefaultOutputFormat("pdf")).toBe("pdf");
    expect(getOutputFormatOptions("image").map((format) => format.value)).toContain("svg");
    expect(getOutputFormatOptions("video").map((format) => format.value)).toEqual(["webm", "mp4"]);
    expect(getOutputFormatOptions("pdf").map((format) => format.value)).toEqual(["pdf"]);
    expect(getOutputMimeTypeForFormat("image", "gif")).toBe("image/gif");
    expect(getOutputMimeTypeForFormat("video", "mp4")).toBe("video/mp4");
    expect(getOutputMimeTypeForFormat("pdf", "pdf")).toBe("application/pdf");
  });

  it("detects PDFs from MIME type and file extension fallback", () => {
    expect(detectFileType(new File(["%PDF"], "contract.pdf", { type: "application/pdf" }))).toBe("pdf");
    expect(detectFileType(new File(["%PDF"], "scanned.PDF", { type: "" }))).toBe("pdf");
    expect(getFileType(new File(["%PDF"], "document.bin", { type: "application/pdf" }))).toBe("pdf");
  });
});
