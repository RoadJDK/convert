import { describe, expect, it, vi } from "vitest";
import {
  createDisplayableImageUrl,
  isHeicLikeFile,
  isTiffLikeFile,
  readDisplayableImageAsDataUrl,
  resolveDisplayableImageBlob,
} from "@/lib/displayableImage";

const pngBlob = new Blob(["decoded"], { type: "image/png" });

describe("displayable image loading", () => {
  it("detects HEIC and TIFF files even when the browser omits MIME metadata", () => {
    expect(isHeicLikeFile(new File(["x"], "photo.HEIC", { type: "" }))).toBe(true);
    expect(isHeicLikeFile(new File(["x"], "photo.bin", { type: "image/heif" }))).toBe(true);
    expect(isTiffLikeFile(new File(["x"], "scan.TIFF", { type: "" }))).toBe(true);
    expect(isTiffLikeFile(new File(["x"], "scan.bin", { type: "image/tiff" }))).toBe(true);
  });

  it("keeps regular browser-displayable images on the original blob", async () => {
    const file = new File(["png"], "icon.png", { type: "image/png" });
    const decoders = {
      decodeHeic: vi.fn(),
      decodeTiff: vi.fn(),
    };

    await expect(resolveDisplayableImageBlob(file, decoders)).resolves.toBe(file);
    expect(decoders.decodeHeic).not.toHaveBeenCalled();
    expect(decoders.decodeTiff).not.toHaveBeenCalled();
  });

  it("decodes HEIC and TIFF inputs to PNG before image/canvas consumers read them", async () => {
    const heic = new File(["heic"], "camera.heic", { type: "image/heic" });
    const tiff = new File(["tiff"], "scan.tif", { type: "" });
    const decoders = {
      decodeHeic: vi.fn().mockResolvedValue(pngBlob),
      decodeTiff: vi.fn().mockResolvedValue(pngBlob),
    };

    await expect(resolveDisplayableImageBlob(heic, decoders)).resolves.toBe(pngBlob);
    await expect(resolveDisplayableImageBlob(tiff, decoders)).resolves.toBe(pngBlob);
    expect(decoders.decodeHeic).toHaveBeenCalledWith(heic);
    expect(decoders.decodeTiff).toHaveBeenCalledWith(tiff);
  });

  it("returns data URLs and revokable object URLs for decoded inputs", async () => {
    const heic = new File(["heic"], "camera.heic", { type: "image/heic" });
    const decoders = {
      decodeHeic: vi.fn().mockResolvedValue(pngBlob),
      decodeTiff: vi.fn(),
    };
    const createSpy = vi.fn().mockReturnValue("blob:decoded");
    const revokeSpy = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createSpy });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeSpy });

    await expect(readDisplayableImageAsDataUrl(heic, decoders)).resolves.toMatch(/^data:image\/png;base64,/);
    const source = await createDisplayableImageUrl(heic, decoders);

    expect(source.url).toBe("blob:decoded");
    source.revoke();
    expect(createSpy).toHaveBeenCalledWith(pngBlob);
    expect(revokeSpy).toHaveBeenCalledWith("blob:decoded");

    vi.restoreAllMocks();
  });
});
