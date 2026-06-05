export function WorkspaceIntro() {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="mono-kicker">lokaler converter</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Dateien rein. Format wählen. Ohne Upload raus.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        Bild-, Video- und Rename-Jobs laufen im Browser. Die KI lädt ihr Modell lokal und bekommt nur deine lokalen Frames.
      </p>
    </div>
  );
}
