import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FileCardPreview } from "@/components/file-card/FileCardPreview";
import { DEFAULT_QUALITY_SETTINGS, type ConvertibleFile } from "@/types/converter";

const makeFile = (type: "image" | "video" = "image"): ConvertibleFile => {
  const mimeType = type === "image" ? "image/png" : "video/webm";

  return {
    id: `${type}-preview`,
    file: new File(["sample"], `sample.${type === "image" ? "png" : "webm"}`, { type: mimeType }),
    type,
    status: "pending",
    progress: 0,
    originalName: `sample.${type === "image" ? "png" : "webm"}`,
    qualitySettings: { ...DEFAULT_QUALITY_SETTINGS },
    originalSize: 6,
  };
};

describe("FileCardPreview", () => {
  it("centers the type marker inside the preview tile", () => {
    render(<FileCardPreview file={makeFile()} previewUrl="blob:preview" />);

    const marker = screen.getByTestId("file-card-preview-type-icon");

    expect(marker.className).toContain("left-1/2");
    expect(marker.className).toContain("top-1/2");
    expect(marker.className).toContain("-translate-x-1/2");
    expect(marker.className).toContain("-translate-y-1/2");
    expect(marker.className).not.toContain("left-1 top-1");
  });

  it("keeps fallback previews centered when no image frame is available", () => {
    render(<FileCardPreview file={makeFile("video")} />);

    const preview = screen.getByTestId("file-card-preview");
    const marker = screen.getByTestId("file-card-preview-type-icon");

    expect(preview.className).toContain("items-center");
    expect(preview.className).toContain("justify-center");
    expect(marker.className).toContain("left-1/2");
    expect(marker.className).toContain("top-1/2");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
