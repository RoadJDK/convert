import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { imageFilesToPdf } from "@/lib/imageToPdf";

const SAMPLE_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
    "base64",
  ),
);

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

describe("image to PDF conversion", () => {
  it("bundles image files into a local metadata-stripped PDF", async () => {
    const output = await imageFilesToPdf([
      new File([SAMPLE_PNG], "first.png", { type: "image/png" }),
      new File([SAMPLE_PNG], "second.png", { type: "image/png" }),
    ]);

    expect(output.type).toBe("application/pdf");
    expect(output.size).toBeGreaterThan(0);

    const pdf = await PDFDocument.load(await readBlobAsArrayBuffer(output));
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe("Maibach Convert PDF");
    expect(pdf.getAuthor()).toBe("Maibach Convert");
  });
});
