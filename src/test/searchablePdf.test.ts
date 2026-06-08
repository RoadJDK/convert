import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

import { createSearchablePdfFromImages } from "@/lib/searchablePdf";

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

describe("searchable PDF OCR conversion", () => {
  it("embeds images and calls an injectable local OCR recognizer", async () => {
    const file = new File([SAMPLE_PNG], "scan.png", { type: "image/png" });
    const recognize = vi.fn(async () => ({ text: "HELLO LOCAL OCR" }));

    const output = await createSearchablePdfFromImages([file], { recognize });

    expect(recognize).toHaveBeenCalledWith(file);
    expect(output.type).toBe("application/pdf");
    expect(output.size).toBeGreaterThan(0);

    const pdf = await PDFDocument.load(await readBlobAsArrayBuffer(output));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Maibach Convert OCR PDF");
    expect(pdf.getAuthor()).toBe("Maibach Convert");
  });
});
