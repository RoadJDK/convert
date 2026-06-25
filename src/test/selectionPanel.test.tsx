import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectionPanel } from "@/components/SelectionPanel";

describe("SelectionPanel", () => {
  it("renders selected-file controls as a persistent tool region, not a dialog", () => {
    render(
      <SelectionPanel
        open
        selectedCount={2}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: /2 Dateien ausgewaehlt|2 Dateien ausgewählt/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a local PDF merge action instead of quality sliders for selected PDFs", () => {
    const onMergePdfs = vi.fn();
    const onSplitPdfs = vi.fn();
    const onRotatePdfs = vi.fn();
    const onCompressPdfs = vi.fn();
    const onRenderPdfPagesToImages = vi.fn();
    const onApply = vi.fn();

    render(
      <SelectionPanel
        open
        selectedCount={2}
        selectedType="pdf"
        onApply={onApply}
        onClose={vi.fn()}
        onCompressPdfs={onCompressPdfs}
        onMergePdfs={onMergePdfs}
        onRenderPdfPagesToImages={onRenderPdfPagesToImages}
        onRotatePdfs={onRotatePdfs}
        onSplitPdfs={onSplitPdfs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "PDFs zu einer Datei machen" }));
    fireEvent.click(screen.getByText("Weitere PDF-Optionen"));
    fireEvent.click(screen.getByRole("button", { name: "Seiten aufteilen" }));
    fireEvent.click(screen.getByRole("button", { name: "90° drehen" }));
    fireEvent.click(screen.getByRole("button", { name: "PDFs kleiner machen" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF-Seiten als Bilder speichern" }));

    expect(onMergePdfs).toHaveBeenCalledTimes(1);
    expect(onSplitPdfs).toHaveBeenCalledTimes(1);
    expect(onRotatePdfs).toHaveBeenCalledWith(90);
    expect(onCompressPdfs).toHaveBeenCalledTimes(1);
    expect(onRenderPdfPagesToImages).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/lokal im Browser/i)).toBeInTheDocument();
    expect(screen.queryByText("Grösse & Qualität")).not.toBeInTheDocument();
  });

  it("allows page reorder input for one selected PDF", () => {
    const onReorderPdf = vi.fn();

    render(
      <SelectionPanel
        open
        selectedCount={1}
        selectedType="pdf"
        onApply={vi.fn()}
        onClose={vi.fn()}
        onReorderPdf={onReorderPdf}
      />,
    );

    fireEvent.click(screen.getByText("Weitere PDF-Optionen"));
    fireEvent.change(screen.getByLabelText("Seitenfolge"), { target: { value: "2,1" } });
    fireEvent.click(screen.getByRole("button", { name: "Seiten neu sortieren" }));

    expect(onReorderPdf).toHaveBeenCalledWith("2,1");
  });

  it("offers a local image-to-PDF action for selected images", () => {
    const onCreatePdfFromImages = vi.fn();
    const onCreateSearchablePdfFromImages = vi.fn();
    const onApply = vi.fn();

    render(
      <SelectionPanel
        open
        selectedCount={2}
        selectedType="image"
        onApply={onApply}
        onClose={vi.fn()}
        onCreatePdfFromImages={onCreatePdfFromImages}
        onCreateSearchablePdfFromImages={onCreateSearchablePdfFromImages}
      />,
    );

    expect(screen.getByRole("region", { name: "Handout aus Bildern" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bilder als PDF speichern" }));
    fireEvent.click(screen.getByRole("button", { name: "Text in PDF suchbar machen" }));

    expect(onCreatePdfFromImages).toHaveBeenCalledTimes(1);
    expect(onCreateSearchablePdfFromImages).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/lokal im Browser/i)).toBeInTheDocument();
    expect(screen.getByText("Grösse & Qualität")).toBeInTheDocument();
  });

  it("applies a bulk conversion preset and closes the sidebar", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <SelectionPanel
        open
        selectedCount={2}
        selectedType="image"
        onApply={onApply}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upload klein" }));

    expect(onApply).toHaveBeenCalledWith({
      qualitySettings: expect.objectContaining({
        mode: "maxSize",
        maxSizeKB: 300,
        outputFormat: "jpeg",
      }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
