import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PDF_MIME_TYPE = "application/pdf";
const PDF_OUTPUT_TITLE = "Maibach Convert OCR PDF";
const PDF_OUTPUT_AUTHOR = "Maibach Convert";
const DEFAULT_OCR_LANGUAGE = "eng";

export type OcrResult = {
  text: string;
};

export type OcrRecognizer = (file: File) => Promise<OcrResult | string>;

export type SearchablePdfOptions = {
  language?: string;
  recognize?: OcrRecognizer;
};

type TestOcrWindow = Window & {
  __maibachTestOcr?: OcrRecognizer;
};

export async function createSearchablePdfFromImages(
  files: File[],
  options: SearchablePdfOptions = {},
): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("Mindestens ein Bild ist erforderlich.");
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const recognize = options.recognize ?? createDefaultRecognizer(options.language ?? DEFAULT_OCR_LANGUAGE);

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

    const result = await recognize(file);
    const text = typeof result === "string" ? result : result.text;
    const normalizedText = normalizeOcrText(text);
    if (normalizedText.length > 0) {
      const fontSize = Math.max(1, Math.min(10, image.height / 8));
      page.drawText(normalizedText, {
        x: Math.max(1, image.width * 0.02),
        y: Math.max(1, image.height * 0.02),
        size: fontSize,
        font,
        color: rgb(1, 1, 1),
        opacity: 0.01,
        maxWidth: Math.max(1, image.width * 0.96),
      });
    }
  }

  applyPdfMetadata(pdf);
  return savePdfAsBlob(pdf);
}

function createDefaultRecognizer(language: string): OcrRecognizer {
  return async (file) => {
    if (typeof window !== "undefined") {
      const testRecognizer = (window as TestOcrWindow).__maibachTestOcr;
      if (testRecognizer) {
        return testRecognizer(file);
      }
    }

    const tesseract = await import("tesseract.js");
    const worker = await tesseract.createWorker(language);
    try {
      const result = await worker.recognize(file);
      return { text: result.data.text ?? "" };
    } finally {
      await worker.terminate();
    }
  };
}

function normalizeOcrText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
  pdf.setSubject("Local browser OCR conversion");
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
