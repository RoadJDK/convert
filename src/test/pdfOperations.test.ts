import { describe, expect, it } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";

import { mergePdfFiles, stripPdfMetadata } from "@/lib/pdfOperations";

async function createPdfFile(name: string, pageCount: number, title: string): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Private Author");

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([200, 120]);
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
});
