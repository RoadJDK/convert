const HEIC_TO_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js";
const PAKO_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js";
const UTIF_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js";

type ImageDecoder = (file: File) => Promise<Blob>;

export type DisplayableImageDecoders = {
  decodeHeic?: ImageDecoder;
  decodeTiff?: ImageDecoder;
};

type DisplayableImageSource = {
  blob: Blob;
  url: string;
  revoke: () => void;
};

type HeicToConverter = ((options: {
  blob: Blob;
  type: "image/png";
  quality?: number;
}) => Promise<Blob | Blob[]>) & {
  isHeic?: (blob: Blob) => Promise<boolean>;
};

type TiffDirectory = {
  width?: number;
  height?: number;
  data?: Uint8Array;
};

type UtifModule = {
  decode: (buffer: ArrayBuffer) => TiffDirectory[];
  decodeImage: (buffer: ArrayBuffer, directory: TiffDirectory) => void;
  toRGBA8: (directory: TiffDirectory) => Uint8Array;
};

declare global {
  interface Window {
    HeicTo?: HeicToConverter;
    UTIF?: UtifModule;
    pako?: unknown;
  }
}

const loadedScripts = new Map<string, Promise<void>>();

export function isHeicLikeFile(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  const extension = getExtension(file.name);

  return mimeType === "image/heic" || mimeType === "image/heif" || extension === "heic" || extension === "heif";
}

export function isTiffLikeFile(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  const extension = getExtension(file.name);

  return mimeType === "image/tiff" || mimeType === "image/x-tiff" || extension === "tif" || extension === "tiff";
}

export async function resolveDisplayableImageBlob(
  file: File,
  decoders: DisplayableImageDecoders = {},
): Promise<Blob> {
  if (isHeicLikeFile(file)) {
    return (decoders.decodeHeic ?? decodeHeicToPng)(file);
  }

  if (isTiffLikeFile(file)) {
    return (decoders.decodeTiff ?? decodeTiffToPng)(file);
  }

  return file;
}

export async function readDisplayableImageAsDataUrl(
  file: File,
  decoders?: DisplayableImageDecoders,
): Promise<string> {
  const blob = await resolveDisplayableImageBlob(file, decoders);
  return readBlobAsDataUrl(blob);
}

export async function createDisplayableImageUrl(
  file: File,
  decoders?: DisplayableImageDecoders,
): Promise<DisplayableImageSource> {
  const blob = await resolveDisplayableImageBlob(file, decoders);
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    revoke: () => URL.revokeObjectURL(url),
  };
}

async function decodeHeicToPng(file: File): Promise<Blob> {
  const heicTo = await loadHeicTo();

  if (heicTo.isHeic && !(await heicTo.isHeic(file))) {
    throw new Error("Die Datei sieht nicht wie ein HEIC/HEIF-Bild aus.");
  }

  const output = await heicTo({ blob: file, type: "image/png", quality: 0.94 });
  const blob = Array.isArray(output) ? output[0] : output;

  if (!isBlob(blob)) {
    throw new Error("HEIC/HEIF konnte nicht in PNG dekodiert werden.");
  }

  return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
}

async function decodeTiffToPng(file: File): Promise<Blob> {
  const utif = await loadUtif();
  const buffer = await file.arrayBuffer();
  const directories = utif.decode(buffer);
  const directory = directories[0];

  if (!directory) {
    throw new Error("TIFF enthaelt kein dekodierbares Bild.");
  }

  utif.decodeImage(buffer, directory);

  const { width, height } = directory;
  if (!width || !height) {
    throw new Error("TIFF-Breite oder -Hoehe konnte nicht gelesen werden.");
  }

  const rgba = utif.toRGBA8(directory);
  return rgbaToPngBlob(rgba, width, height);
}

async function loadHeicTo(): Promise<HeicToConverter> {
  if (typeof window === "undefined") {
    throw new Error("HEIC/HEIF-Dekodierung ist nur im Browser verfuegbar.");
  }

  await loadScriptOnce(HEIC_TO_SCRIPT_URL);

  if (typeof window.HeicTo !== "function") {
    throw new Error("HEIC/HEIF-Dekoder konnte nicht geladen werden.");
  }

  return window.HeicTo;
}

async function loadUtif(): Promise<UtifModule> {
  if (typeof window === "undefined") {
    throw new Error("TIFF-Dekodierung ist nur im Browser verfuegbar.");
  }

  await loadScriptOnce(PAKO_SCRIPT_URL);
  await loadScriptOnce(UTIF_SCRIPT_URL);

  if (!window.UTIF) {
    throw new Error("TIFF-Dekoder konnte nicht geladen werden.");
  }

  return window.UTIF;
}

function loadScriptOnce(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Dekoder konnte nicht geladen werden: ${src}`));
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}

function rgbaToPngBlob(rgba: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas-Kontext konnte nicht erstellt werden.");
  }

  const clamped = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  context.putImageData(new ImageData(clamped, width, height), 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("TIFF konnte nicht als PNG serialisiert werden."));
      }
    }, "image/png");
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

function getExtension(fileName: string): string | null {
  const lastSegment = fileName.split(/[\\/]/).pop() ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}
