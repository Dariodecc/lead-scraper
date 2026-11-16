"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowsClockwise, Pulse } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { LevelBadge, LOG_CATEGORY_LABEL } from "@/components/status-badges";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const RETRYABLE_CATEGORIES = new Set(["webhook_delivery", "ai_analysis"]);

interface LogRow {
  id: string;
  level: string;
  category: string;
  message: string;
  createdAt: string;
  placeId: string | null;
  costUsd: string | null;
  search: { title: string } | null;
}

export default function LogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (level !== "all") params.set("level", level);
    if (category !== "all") params.set("category", category);
    params.set("page", String(page));
    params.set("pageSize", "25");
    const res = await fetch(`/api/logs?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotalPages(data.totalPages ?? 1);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [level, category, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch log al mount e al cambio filtri/pagina
    load();
  }, [load]);

  async function retry(log: LogRow) {
    if (!log.placeId) return;
    setRetrying((r) => ({ ...r, [log.id]: true }));
    try {
      const res = await fetch(`/api/places/${log.placeId}/redeliver`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Riprova accodata", description: "L'esito comparirà qui tra qualche secondo.", tone: "success" });
        setTimeout(load, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Riprova non riuscita", description: data.error, tone: "danger" });
      }
    } finally {
      setRetrying((r) => ({ ...r, [log.id]: false }));
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = level !== "all" || category !== "all";

  return (
    <>
      <PageHeader
        title="Logs"
        description="Esecuzioni delle ricerche, chiamate a Google Places, analisi AI, consegne webhook ed errori di sistema."
      />

      <div className="rise mb-4 flex flex-wrap items-center gap-3" style={{ "--i": 1 } as React.CSSProperties}>
        <Select
          aria-label="Filtra per livello"
          className="w-44"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Livello: tutti</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Errore</option>
        </Select>
        <Select
          aria-label="Filtra per categoria"
          className="w-52"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Categoria: tutte</option>
          {Object.entries(LOG_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLevel("all");
              setCategory("all");
              setPage(1);
            }}
          >
            Azzera filtri
          </Button>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label="Caricamento" className="grid gap-2 rounded-lg border border-border bg-card p-4 shadow-panel">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card">
          <EmptyState
            icon={Pulse}
            title={filtered ? "Nessun log con questi filtri" : "Nessun log ancora"}
            description={
              filtered
                ? "Prova ad allargare livello o categoria."
                : "Comparirà qui alla prima esecuzione di una ricerca."
            }
          />
        </div>
      ) : (
        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <Table minWidth={900}>
            <thead>
              <tr>
                <Th>Livello</Th>
                <Th>Categoria</Th>
                <Th>Messaggio</Th>
                <Th>Ricerca</Th>
                <Th className="text-right">Costo</Th>
                <Th>Data</Th>
                <Th>
                  <span className="sr-only">Azione</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const open = expanded.has(log.id);
                const canRetry = RETRYABLE_CATEGORIES.has(log.category) && log.level === "error" && log.placeId;
                return (
                  <Tr key={log.id} className="align-top">
                    <Td>
                      <LevelBadge level={log.level} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{LOG_CATEGORY_LABEL[log.category] ?? log.category}</Td>
                    <Td className="max-w-[420px]">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleExpanded(log.id)}
                        title={open ? "Comprimi" : "Mostra il messaggio intero"}
                        className={cn(
                          "block w-full break-words rounded-sm text-left font-mono text-xs leading-relaxed text-foreground/85 transition-colors hover:text-foreground",
                          !open && "line-clamp-2",
                        )}
                      >
                        {log.message}
                      </button>
                    </Td>
                    <Td className="max-w-[180px] truncate text-muted-foreground" title={log.search?.title}>
                      {log.search?.title ?? "—"}
                    </Td>
                    <Td className="num text-right text-muted-foreground">
                      {log.costUsd != null ? `$${Number(log.costUsd).toFixed(4)}` : "—"}
                    </Td>
                    <Td className="num whitespace-nowrap text-xs text-muted-soft">{formatDateTime(log.createdAt)}</Td>
                    <Td>
                      {canRetry && (
                        <Button size="sm" variant="outline" loading={retrying[log.id]} onClick={() => retry(log)}>
                          {!retrying[log.id] && <ArrowsClockwise aria-hidden />}
                          Riprova
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} total={total} noun="log totali" onPage={setPage} />
        </div>
      )}
    </>
  );
}
