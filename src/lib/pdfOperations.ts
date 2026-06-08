import { PDFDocument } from "pdf-lib";

const PDF_MIME_TYPE = "application/pdf";
const PDF_OUTPUT_TITLE = "Maibach Convert PDF";
const PDF_OUTPUT_AUTHOR = "Maibach Convert";

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

async function loadPdfFile(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await readBlobAsArrayBuffer(file));
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`PDF konnte nicht lokal gelesen werden: ${file.name}.${detail}`);
  }
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
  const bytes = await pdf.save();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: PDF_MIME_TYPE });
}
