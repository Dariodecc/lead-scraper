"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { placeTypeLabel } from "@/lib/placeTypes";

interface SearchRow {
  id: string;
  title: string;
  areaLabel: string;
  categoryPlaceType: string;
  frequency: "once" | "weekly" | "monthly";
  status: "draft" | "active" | "paused";
  listId: string | null;
}

const COLUMNS = ["Titolo", "Zona", "Categoria", "Frequenza", "Stato", "Prossima", "Azioni"] as const;

const STATUS_LABEL: Record<string, string> = { draft: "Bozza", active: "Attiva", paused: "In pausa" };
const FREQ_LABEL: Record<string, string> = { once: "Una tantum", weekly: "Settimanale", monthly: "Mensile" };

export default function RicerchePage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/searches");
    const data = await res.json();
    setSearches(data.searches ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati iniziali al mount
    load();
  }, [load]);

  async function toggleStatus(s: SearchRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (s.status === "draft" && !s.listId) return;
    const nextStatus = s.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/searches/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) load();
  }

  async function runTest(s: SearchRow, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/searches/${s.id}/test`, { method: "POST" });
    load();
  }

  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Ricerche</h1>
          <p className="text-sm text-muted-foreground">
            Zona e categoria da liste compatibili con Google Places, frequenza per ricerca
          </p>
        </div>
        <button
          className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
          onClick={() => router.push("/ricerche/new")}
        >
          + Nuova ricerca
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.7fr_1fr_1fr_0.85fr_0.75fr_1fr_1.6fr] gap-x-3 border-b border-border bg-muted px-5 py-3">
          {COLUMNS.map((col) => (
            <span
              key={col}
              className={`min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground ${col === "Azioni" ? "text-right" : ""}`}
            >
              {col}
            </span>
          ))}
        </div>

        {!loading && searches.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nessuna ricerca ancora — crea la prima ricerca con &ldquo;+ Nuova ricerca&rdquo;.
          </div>
        )}

        {searches.map((s) => (
          <div
            key={s.id}
            className="grid cursor-pointer grid-cols-[1.7fr_1fr_1fr_0.85fr_0.75fr_1fr_1.6fr] items-center gap-x-3 border-b border-hairline-soft px-5 py-4"
            onClick={() => router.push(`/ricerche/${s.id}`)}
          >
            <span className="min-w-0 truncate text-sm font-medium" title={s.title}>
              {s.title}
            </span>
            <span className="min-w-0 truncate text-[13px]">{s.areaLabel}</span>
            <span className="min-w-0 truncate text-[13px]">{placeTypeLabel(s.categoryPlaceType)}</span>
            <span className="min-w-0 text-[13px]">{FREQ_LABEL[s.frequency]}</span>
            <span
              className={`min-w-0 w-fit rounded-full px-3 py-0.5 text-xs font-medium ${
                s.status === "active"
                  ? "bg-success/10 text-success"
                  : s.status === "paused"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {STATUS_LABEL[s.status]}
            </span>
            <span className="min-w-0 text-xs text-muted-foreground">
              {s.status === "active" ? "vedi dettaglio" : "—"}
            </span>
            <span className="min-w-0 flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                className="rounded-md border border-border bg-background px-2 py-1.5 text-[11.5px] font-semibold whitespace-nowrap"
                onClick={(e) => runTest(s, e)}
              >
                TEST
              </button>
              <button
                disabled={s.status === "draft" && !s.listId}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-[11.5px] font-semibold whitespace-nowrap disabled:opacity-40"
                onClick={(e) => toggleStatus(s, e)}
              >
                {s.status === "active" ? "Pausa" : "Attiva"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
