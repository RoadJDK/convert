import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DropZone } from "@/components/DropZone";

describe("DropZone", () => {
  it("keeps normal mouse hover visually stable", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");
    const initialClassName = dropZone.className;

    fireEvent.mouseEnter(dropZone);
    fireEvent.mouseLeave(dropZone);

    expect(dropZone.className).toBe(initialClassName);
    expect(dropZone.className).not.toContain("hover:");
    expect(dropZone.className).not.toContain("scale-");
  });

  it("links the visible drop-zone copy to the file input", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");
    const fileInput = screen.getByLabelText(/Klicken oder Dateien hier ablegen/i);

    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("multiple");
    expect(fileInput).toHaveAttribute("id");
    expect(dropZone).toHaveAttribute("for", fileInput.id);
  });

  it("advertises and accepts PDFs alongside images and videos", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const fileInput = screen.getByLabelText(/Klicken oder Dateien hier ablegen/i);

    expect(fileInput).toHaveAttribute("accept", expect.stringContaining("application/pdf"));
    expect(screen.getAllByText("PDF").length).toBeGreaterThan(0);
    expect(screen.getByText(/alles gemischt/i)).toBeVisible();
  });

  it("reports unsupported files instead of silently dropping them", () => {
    const onFilesAdded = vi.fn();
    render(<DropZone onFilesAdded={onFilesAdded} />);

    const fileInput = screen.getByLabelText(/Klicken oder Dateien hier ablegen/i);
    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(["ok"], "ok.png", { type: "image/png" }),
          new File(["bad"], "archive.exe", { type: "application/x-msdownload" }),
        ],
      },
    });

    expect(onFilesAdded).toHaveBeenCalledWith([expect.objectContaining({ name: "ok.png" })]);
    expect(screen.getByRole("status")).toHaveTextContent("1 Datei nicht unterstützt: archive.exe");
  });

  it("uses a compact animated layout once files exist", () => {
    render(<DropZone hasFiles onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");
    const initialCopy = screen.getByText("Klicken oder Dateien hier ablegen");
    const compactCopy = screen.getByText("Weitere Dateien wählen");

    expect(dropZone).toHaveAttribute("data-compact", "true");
    expect(dropZone.className).toContain("min-h-[144px]");
    expect(dropZone.className).toContain("motion-safe:duration-300");
    expect(dropZone.className).not.toContain("min-h-[264px]");
    expect(dropZone.className).not.toContain("transition-[min-height,padding");
    expect(initialCopy.closest("[aria-hidden='true']")).toBeInTheDocument();
    expect(compactCopy.closest("[aria-hidden='false']")).toBeInTheDocument();
  });

  it("keeps drag state while moving across inner content", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");
    const heading = screen.getByText("Klicken oder Dateien hier ablegen");

    fireEvent.dragEnter(dropZone);
    expect(dropZone.className.split(/\s+/)).toContain("border-[var(--ms-accent)]");

    fireEvent.dragEnter(heading);
    fireEvent.dragLeave(heading);
    expect(dropZone.className.split(/\s+/)).toContain("border-[var(--ms-accent)]");

    fireEvent.dragLeave(dropZone);
    expect(dropZone.className.split(/\s+/)).not.toContain("border-[var(--ms-accent)]");
    expect(dropZone.className.split(/\s+/)).toContain("border-[var(--ms-hairline)]");
  });
});
