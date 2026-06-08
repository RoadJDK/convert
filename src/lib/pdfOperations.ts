import { degrees, PDFDocument } from "pdf-lib";

const PDF_MIME_TYPE = "application/pdf";
const PDF_OUTPUT_TITLE = "Maibach Convert PDF";
const PDF_OUTPUT_AUTHOR = "Maibach Convert";

export type PdfRotationDegrees = 90 | 180 | 270;

export type SplitPdfPageResult = {
  blob: Blob;
  pageNumber: number;
  suggestedName: string;
};

export async function mergePdfFiles(files: File[]): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("Mindestens eine PDF-Datei ist erforderlich.");
  }

  const output = await PDFDocument.create();

  for (const file of files) {
    const source = await loadPdfFile(file);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }

  applyPdfMetadata(output);
  return savePdfAsBlob(output);
}

export async function stripPdfMetadata(file: File): Promise<Blob> {
  return mergePdfFiles([file]);
}

export async function splitPdfFile(file: File): Promise<SplitPdfPageResult[]> {
  const source = await loadPdfFile(file);
  const baseName = getBaseName(file.name);
  const results: SplitPdfPageResult[] = [];

  for (const pageIndex of source.getPageIndices()) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [pageIndex]);
    output.addPage(page);
    applyPdfMetadata(output);
    results.push({
      blob: await savePdfAsBlob(output),
      pageNumber: pageIndex + 1,
      suggestedName: `${baseName}-page-${pageIndex + 1}`,
    });
  }

  return results;
}

export async function rotatePdfFile(file: File, rotation: PdfRotationDegrees): Promise<Blob> {
  const source = await loadPdfFile(file);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, source.getPageIndices());

  pages.forEach((page) => {
    const nextRotation = normalizeRotation(page.getRotation().angle + rotation);
    page.setRotation(degrees(nextRotation));
    output.addPage(page);
  });

  applyPdfMetadata(output);
  return savePdfAsBlob(output);
}

export async function reorderPdfFile(file: File, pageOrder: number[]): Promise<Blob> {
  const source = await loadPdfFile(file);
  const pageCount = source.getPageCount();
  const normalizedOrder = validatePageOrder(pageOrder, pageCount);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, normalizedOrder);
  pages.forEach((page) => output.addPage(page));
  applyPdfMetadata(output);
  return savePdfAsBlob(output);
}

export async function compressPdfFile(file: File): Promise<Blob> {
  const source = await loadPdfFile(file);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, source.getPageIndices());
  pages.forEach((page) => output.addPage(page));
  applyPdfMetadata(output);
  return savePdfAsBlob(output);
}

async function loadPdfFile(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await readBlobAsArrayBuffer(file));
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`PDF konnte nicht lokal gelesen werden: ${file.name}.${detail}`);
  }
}

function validatePageOrder(pageOrder: number[], pageCount: number): number[] {
  if (pageOrder.length === 0) {
    throw new Error("Mindestens eine Seite muss angegeben werden.");
  }

  const seen = new Set<number>();
  for (const pageIndex of pageOrder) {
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
      throw new Error(`Ungueltige Seitenzahl: ${pageIndex + 1}`);
    }
    if (seen.has(pageIndex)) {
      throw new Error(`Doppelte Seitenzahl: ${pageIndex + 1}`);
    }
    seen.add(pageIndex);
  }

  return pageOrder;
}

function normalizeRotation(rotation: number): PdfRotationDegrees | 0 {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function getBaseName(fileName: string): string {
  return (fileName.split(/[\\/]/).pop() ?? fileName).replace(/\.pdf$/i, "") || "document";
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden."));
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Datei konnte nicht als ArrayBuffer gelesen werden."));
        }
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  return new Response(blob).arrayBuffer();
}

function applyPdfMetadata(pdf: PDFDocument): void {
  const now = new Date(0);
  pdf.setTitle(PDF_OUTPUT_TITLE);
  pdf.setAuthor(PDF_OUTPUT_AUTHOR);
  pdf.setCreator(PDF_OUTPUT_AUTHOR);
  pdf.setProducer(PDF_OUTPUT_AUTHOR);
  pdf.setSubject("Local browser conversion");
  pdf.setKeywords([]);
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
}

async function savePdfAsBlob(pdf: PDFDocument): Promise<Blob> {
  const bytes = await pdf.save({ useObjectStreams: true });
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: PDF_MIME_TYPE });
}
