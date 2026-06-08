import { describe, expect, it } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";

import {
  compressPdfFile,
  mergePdfFiles,
  reorderPdfFile,
  rotatePdfFile,
  splitPdfFile,
  stripPdfMetadata,
} from "@/lib/pdfOperations";

async function createPdfFile(
  name: string,
  pageCount: number,
  title: string,
  pageSizes: Array<[number, number]> = [],
): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Private Author");

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage(pageSizes[index] ?? [200, 120]);
    page.drawText(`${name} page ${index + 1}`, {
      color: rgb(0.1, 0.2, 0.3),
      size: 12,
      x: 24,
      y: 72,
    });
  }

  const bytes = await pdf.save();
  return new File([bytes], name, { type: "application/pdf" });
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

describe("pdf operations", () => {
  it("merges multiple PDFs locally and strips source metadata", async () => {
    const first = await createPdfFile("first.pdf", 1, "Private Contract");
    const second = await createPdfFile("second.pdf", 2, "Private Invoice");

    const merged = await mergePdfFiles([first, second]);

    expect(merged.type).toBe("application/pdf");
    expect(merged.size).toBeGreaterThan(0);

    const output = await PDFDocument.load(await readBlobAsArrayBuffer(merged));
    expect(output.getPageCount()).toBe(3);
    expect(output.getTitle()).toBe("Maibach Convert PDF");
    expect(output.getAuthor()).toBe("Maibach Convert");
  });

  it("rewrites a single PDF as a metadata-stripped local PDF", async () => {
    const source = await createPdfFile("private.pdf", 1, "Private Draft");

    const stripped = await stripPdfMetadata(source);
    const output = await PDFDocument.load(await readBlobAsArrayBuffer(stripped));

    expect(stripped.type).toBe("application/pdf");
    expect(output.getPageCount()).toBe(1);
    expect(output.getTitle()).toBe("Maibach Convert PDF");
    expect(output.getAuthor()).toBe("Maibach Convert");
  });

  it("splits every page into a separate metadata-stripped PDF", async () => {
    const source = await createPdfFile("bundle.pdf", 3, "Private Bundle");

    const pages = await splitPdfFile(source);

    expect(pages).toHaveLength(3);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2, 3]);
    expect(pages.map((page) => page.suggestedName)).toEqual([
      "bundle-page-1",
      "bundle-page-2",
      "bundle-page-3",
    ]);

    for (const page of pages) {
      expect(page.blob.type).toBe("application/pdf");
      const output = await PDFDocument.load(await readBlobAsArrayBuffer(page.blob));
      expect(output.getPageCount()).toBe(1);
      expect(output.getAuthor()).toBe("Maibach Convert");
    }
  });

  it("rotates every PDF page locally", async () => {
    const source = await createPdfFile("rotate.pdf", 2, "Private Rotate");

    const rotated = await rotatePdfFile(source, 90);
    const output = await PDFDocument.load(await readBlobAsArrayBuffer(rotated));

    expect(rotated.type).toBe("application/pdf");
    expect(output.getPageCount()).toBe(2);
    expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([90, 90]);
    expect(output.getTitle()).toBe("Maibach Convert PDF");
  });

  it("reorders pages using a validated zero-based page order", async () => {
    const source = await createPdfFile("order.pdf", 3, "Private Order", [
      [200, 120],
      [240, 140],
      [280, 160],
    ]);

    const reordered = await reorderPdfFile(source, [2, 0]);
    const output = await PDFDocument.load(await readBlobAsArrayBuffer(reordered));
    const [first, second] = output.getPages();

    expect(output.getPageCount()).toBe(2);
    expect(first.getWidth()).toBe(280);
    expect(second.getWidth()).toBe(200);
    expect(output.getAuthor()).toBe("Maibach Convert");
  });

  it("rewrites a PDF through the local compression path", async () => {
    const source = await createPdfFile("compress.pdf", 2, "Private Compress");

    const compressed = await compressPdfFile(source);
    const output = await PDFDocument.load(await readBlobAsArrayBuffer(compressed));

    expect(compressed.type).toBe("application/pdf");
    expect(compressed.size).toBeGreaterThan(0);
    expect(output.getPageCount()).toBe(2);
    expect(output.getTitle()).toBe("Maibach Convert PDF");
  });
});
