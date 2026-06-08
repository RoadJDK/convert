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
    const onApply = vi.fn();

    render(
      <BulkSettingsSidebar
        open
        selectedCount={2}
        selectedType="pdf"
        onApply={onApply}
        onClose={vi.fn()}
        onMergePdfs={onMergePdfs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "PDFs zusammenführen" }));

    expect(onMergePdfs).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/lokal im Browser/i)).toBeInTheDocument();
    expect(screen.queryByText("Qualitätseinstellungen")).not.toBeInTheDocument();
  });
});
