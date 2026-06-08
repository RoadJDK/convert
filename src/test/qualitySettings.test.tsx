import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QualitySettings } from "@/components/QualitySettings";
import { DEFAULT_QUALITY_SETTINGS } from "@/types/converter";

describe("QualitySettings", () => {
  it("labels removal controls with local authorization and limitation copy", async () => {
    const onCleanupAreaClick = vi.fn();

    render(
      <QualitySettings
        settings={DEFAULT_QUALITY_SETTINGS}
        onChange={vi.fn()}
        fileType="image"
        removeBackground={false}
        onRemoveBackgroundChange={vi.fn()}
        removeWatermark={false}
        onRemoveWatermarkChange={vi.fn()}
        onCleanupAreaClick={onCleanupAreaClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Qualitätseinstellungen" }));

    expect(await screen.findByLabelText("Hintergrund lokal entfernen")).toBeInTheDocument();
    expect(screen.getByLabelText("Watermark bereinigen")).toBeInTheDocument();
    expect(screen.getByText(/Nur für eigene Bilder/i)).toBeInTheDocument();
    expect(screen.getByText(/keine vollständige Entfernungsgarantie/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bereich wählen" }));
    expect(onCleanupAreaClick).toHaveBeenCalledTimes(1);
  });

  it("offers video cleanup without image background removal controls", async () => {
    const onCleanupAreaClick = vi.fn();

    render(
      <QualitySettings
        settings={DEFAULT_QUALITY_SETTINGS}
        onChange={vi.fn()}
        fileType="video"
        removeWatermark={false}
        onRemoveWatermarkChange={vi.fn()}
        onCleanupAreaClick={onCleanupAreaClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Qualitätseinstellungen" }));

    expect(await screen.findByLabelText("Watermark bereinigen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hintergrund lokal entfernen")).not.toBeInTheDocument();
    expect(screen.getByText(/Nur für eigene Videos/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bereich wählen" }));
    expect(onCleanupAreaClick).toHaveBeenCalledTimes(1);
  });

  it("applies image presets through the settings popover", async () => {
    const onChange = vi.fn();

    render(
      <QualitySettings
        settings={DEFAULT_QUALITY_SETTINGS}
        onChange={onChange}
        fileType="image"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Qualitätseinstellungen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Kleiner JPEG" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mode: "maxSize",
      maxSizeKB: 300,
      outputFormat: "jpeg",
      scale: 100,
    }));
  });
});
