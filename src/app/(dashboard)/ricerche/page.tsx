const COLUMNS = [
  "Titolo",
  "Zona",
  "Categoria",
  "Frequenza",
  "Stato",
  "Prossima",
  "Azioni",
] as const;

export default function RicerchePage() {
  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">
            Ricerche
          </h1>
          <p className="text-sm text-muted-foreground">
            Zona e categoria da liste compatibili con Google Places, frequenza
            e webhook per ricerca
          </p>
        </div>
        <button className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
          + Nuova ricerca
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.7fr_1fr_1fr_0.85fr_0.75fr_1fr_1.6fr] gap-x-3 border-b border-border bg-muted px-5 py-3">
          {COLUMNS.map((col) => (
            <span
              key={col}
              className={`text-xs font-medium uppercase tracking-wide text-muted-foreground ${
                col === "Azioni" ? "text-right" : ""
              }`}
            >
              {col}
            </span>
          ))}
        </div>
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Nessuna ricerca ancora — crea la prima ricerca con &ldquo;+ Nuova
          ricerca&rdquo;.
        </div>
      </div>
    </div>
  );
}
