"use client";

import { useCallback, useEffect, useState } from "react";

const COLUMNS = ["Livello", "Categoria", "Messaggio", "Ricerca", "Data", "Azione"] as const;

const LEVEL_LABEL: Record<string, string> = { info: "Info", warning: "Warning", error: "Error" };
const CATEGORY_LABEL: Record<string, string> = {
  search_run: "Esecuzione ricerca",
  google_api: "Google API",
  webhook_delivery: "Consegna webhook",
  system: "Sistema",
};
const LEVEL_STYLE: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
};

interface LogRow {
  id: string;
  level: string;
  category: string;
  message: string;
  createdAt: string;
  placeId: string | null;
  search: { title: string } | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    if (category !== "all") params.set("category", category);
    const res = await fetch(`/api/logs?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
  }, [level, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch log al mount e al cambio filtri
    load();
  }, [load]);

  async function retry(log: LogRow) {
    if (!log.placeId) return;
    setRetrying((r) => ({ ...r, [log.id]: true }));
    try {
      await fetch(`/api/places/${log.placeId}/redeliver`, { method: "POST" });
      setTimeout(load, 1500);
    } finally {
      setRetrying((r) => ({ ...r, [log.id]: false }));
    }
  }

  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Esecuzioni ricerche, chiamate Google Places, consegne webhook, errori di sistema
        </p>
      </div>

      <div className="mb-5 flex gap-3">
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">Livello — tutti</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
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
            <span key={col} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {col}
            </span>
          ))}
        </div>

        {logs.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nessun log ancora — comparirà qui alla prima esecuzione di una ricerca.
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-[0.8fr_1.2fr_2.4fr_1.3fr_1.3fr_1fr] items-center gap-x-4 border-b border-hairline-soft px-5 py-3.5"
          >
            <span className={`w-fit rounded-full px-3 py-0.5 text-xs font-medium ${LEVEL_STYLE[log.level]}`}>
              {LEVEL_LABEL[log.level]}
            </span>
            <span className="text-[13px]">{CATEGORY_LABEL[log.category]}</span>
            <span className="truncate font-mono text-[13px]" title={log.message}>
              {log.message}
            </span>
            <span className="text-[13px] text-muted-foreground">{log.search?.title ?? "—"}</span>
            <span className="text-xs text-muted-soft">{new Date(log.createdAt).toLocaleString("it-IT")}</span>
            {log.category === "webhook_delivery" && log.level === "error" && log.placeId ? (
              <button
                disabled={retrying[log.id]}
                onClick={() => retry(log)}
                className="w-fit rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {retrying[log.id] ? "In coda…" : "Riprova adesso"}
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
