import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulkSettingsSidebar } from "@/components/BulkSettingsSidebar";

describe("BulkSettingsSidebar", () => {
  it("renders selected-file controls as a persistent tool region, not a dialog", () => {
    render(
      <BulkSettingsSidebar
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
    const onApply = vi.fn();

    render(
      <BulkSettingsSidebar
        open
        selectedCount={2}
        selectedType="pdf"
        onApply={onApply}
        onClose={vi.fn()}
        onCompressPdfs={onCompressPdfs}
        onMergePdfs={onMergePdfs}
        onRotatePdfs={onRotatePdfs}
        onSplitPdfs={onSplitPdfs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "PDFs zusammenführen" }));
    fireEvent.click(screen.getByRole("button", { name: "Seiten aufteilen" }));
    fireEvent.click(screen.getByRole("button", { name: "90° drehen" }));
    fireEvent.click(screen.getByRole("button", { name: "PDFs komprimieren" }));

    expect(onMergePdfs).toHaveBeenCalledTimes(1);
    expect(onSplitPdfs).toHaveBeenCalledTimes(1);
    expect(onRotatePdfs).toHaveBeenCalledWith(90);
    expect(onCompressPdfs).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/lokal im Browser/i)).toBeInTheDocument();
    expect(screen.queryByText("Qualitätseinstellungen")).not.toBeInTheDocument();
  });

  it("allows page reorder input for one selected PDF", () => {
    const onReorderPdf = vi.fn();

    render(
      <BulkSettingsSidebar
        open
        selectedCount={1}
        selectedType="pdf"
        onApply={vi.fn()}
        onClose={vi.fn()}
        onReorderPdf={onReorderPdf}
      />,
    );

    fireEvent.change(screen.getByLabelText("Seitenfolge"), { target: { value: "2,1" } });
    fireEvent.click(screen.getByRole("button", { name: "Seiten neu sortieren" }));

    expect(onReorderPdf).toHaveBeenCalledWith("2,1");
  });
});
