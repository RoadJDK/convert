import { describe, expect, it } from "vitest";
import { shouldExtractVideoPreview } from "@/lib/videoPreviewState";

describe("shouldExtractVideoPreview", () => {
  it("extracts previews for videos without a preview entry", () => {
    expect(shouldExtractVideoPreview({ id: "1", type: "video" }, {})).toBe(true);
  });

  it("does not retry failed previews stored as an empty string", () => {
    expect(shouldExtractVideoPreview({ id: "1", type: "video" }, { "1": "" })).toBe(false);
  });

  it("ignores image files", () => {
    expect(shouldExtractVideoPreview({ id: "1", type: "image" }, {})).toBe(false);
  });
});
