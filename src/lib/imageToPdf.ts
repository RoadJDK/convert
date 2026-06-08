import { PDFDocument } from "pdf-lib";

const PDF_MIME_TYPE = "application/pdf";
const PDF_OUTPUT_TITLE = "Maibach Convert PDF";
const PDF_OUTPUT_AUTHOR = "Maibach Convert";

export async function imageFilesToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("Mindestens ein Bild ist erforderlich.");
  }

  const pdf = await PDFDocument.create();

  for (const file of files) {
    const bytes = new Uint8Array(await readBlobAsArrayBuffer(file));
    const image = isJpegFile(file)
      ? await pdf.embedJpg(bytes)
      : await pdf.embedPng(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  applyPdfMetadata(pdf);
  return savePdfAsBlob(pdf);
}

function isJpegFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === "image/jpeg" || type === "image/jpg" || /\.jpe?g$/.test(name);
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
