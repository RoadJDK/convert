import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type RenderedPdfPageImage = {
  blob: Blob;
  pageNumber: number;
  suggestedName: string;
};

type RenderPdfPagesToPngOptions = {
  scale?: number;
};

export async function renderPdfPagesToPng(
  file: File,
  options: RenderPdfPagesToPngOptions = {},
): Promise<RenderedPdfPageImage[]> {
  const data = new Uint8Array(await readBlobAsArrayBuffer(file));
  const task = getDocument({ data });
  const pdf = await task.promise;
  const scale = options.scale ?? 2;
  const baseName = getBaseName(file.name);

  try {
    const results: RenderedPdfPageImage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context not available");
      }

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      results.push({
        blob: await canvasToBlob(canvas, "image/png"),
        pageNumber,
        suggestedName: `${baseName}-page-${pageNumber}`,
      });
    }
    return results;
  } finally {
    const disposablePdf = pdf as unknown as { destroy?: () => Promise<void> | void };
    await disposablePdf.destroy?.();
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PDF-Seite konnte nicht als PNG geschrieben werden."));
    }, type);
  });
}

function getBaseName(fileName: string): string {
  return (fileName.split(/[\\/]/).pop() ?? fileName).replace(/\.pdf$/i, "") || "document";
}
