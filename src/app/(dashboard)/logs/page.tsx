const COLUMNS = ["Livello", "Categoria", "Messaggio", "Ricerca", "Data", "Azione"] as const;

export default function LogsPage() {
  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">
          Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Esecuzioni ricerche, chiamate Google Places, consegne webhook,
          errori di sistema
        </p>
      </div>

      <div className="mb-5 flex gap-3">
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm">
          <option value="all">Livello — tutti</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm">
          <option value="all">Categoria — tutte</option>
          <option value="search_run">Esecuzione ricerca</option>
          <option value="google_api">Google API</option>
          <option value="webhook_delivery">Consegna webhook</option>
          <option value="system">Sistema</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[0.8fr_1.2fr_2.4fr_1.3fr_1.3fr_1fr] gap-x-4 border-b border-border bg-muted px-5 py-3">
          {COLUMNS.map((col) => (
            <span
              key={col}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {col}
            </span>
          ))}
        </div>
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Nessun log ancora — comparirà qui alla prima esecuzione di una
          ricerca.
        </div>
      </div>
    </div>
  );
}
