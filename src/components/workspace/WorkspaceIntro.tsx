export function WorkspaceIntro() {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="mono-kicker">lokaler converter</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Dateien rein. Format wählen. Ohne Upload raus.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        Bild-, Video-, PDF- und Rename-Jobs laufen im Browser. Modelle und App-Shell werden lokal zwischengespeichert.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.055] px-3">
          PWA installierbar
        </span>
        <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.055] px-3">
          Offline nach erstem Laden
        </span>
        <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/[0.055] px-3">
          Keine Upload-Requests für Dateien
        </span>
      </div>
    </div>
  );
}
