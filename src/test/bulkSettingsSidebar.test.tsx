import { render, screen } from "@testing-library/react";
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
});
