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
    const fileInput = screen.getByLabelText(/Dateien hierher ziehen/i);

    expect(fileInput).toHaveAttribute("type", "file");
    expect(fileInput).toHaveAttribute("multiple");
    expect(fileInput).toHaveAttribute("id");
    expect(dropZone).toHaveAttribute("for", fileInput.id);
  });

  it("advertises and accepts PDFs alongside images and videos", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const fileInput = screen.getByLabelText(/Dateien hierher ziehen/i);

    expect(fileInput).toHaveAttribute("accept", expect.stringContaining("application/pdf"));
    expect(screen.getAllByText("PDF").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bilder, Videos oder PDFs/i).length).toBeGreaterThan(0);
  });

  it("uses a compact animated layout once files exist", () => {
    render(<DropZone hasFiles onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");

    expect(dropZone).toHaveAttribute("data-compact", "true");
    expect(dropZone.className).toContain("h-[156px]");
    expect(dropZone.className).toContain("sm:h-[118px]");
    expect(dropZone.className).toContain("motion-safe:duration-300");
    expect(dropZone.className).not.toContain("h-[270px]");
    expect(dropZone.className).not.toContain("transition-[min-height,padding");
  });

  it("keeps drag state while moving across inner content", () => {
    render(<DropZone onFilesAdded={vi.fn()} />);

    const dropZone = screen.getByTestId("drop-zone");
    const heading = screen.getByText("Dateien hierher ziehen");

    fireEvent.dragEnter(dropZone);
    expect(dropZone.className).toContain("bg-primary/10");

    fireEvent.dragEnter(heading);
    fireEvent.dragLeave(heading);
    expect(dropZone.className).toContain("bg-primary/10");

    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain("bg-primary/10");
    expect(dropZone.className).toContain("border-white/10");
  });
});
