"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flask, MagnifyingGlass, Pause, Play, Plus } from "@phosphor-icons/react";
import { placeTypeLabel } from "@/lib/placeTypes";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchStatusBadge } from "@/components/status-badges";
import { useToast } from "@/components/ui/toast";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface SearchRow {
  id: string;
  title: string;
  areaLabel: string;
  categoryPlaceType: string;
  frequency: "once" | "weekly" | "monthly";
  status: "draft" | "active" | "paused";
  listId: string | null;
}

type Filter = "all" | "active" | "paused" | "draft";

const FREQ_LABEL: Record<string, string> = { once: "Una tantum", weekly: "Settimanale", monthly: "Mensile" };

export default function RicerchePage() {
  const router = useRouter();
  const toast = useToast();
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Record<string, "test" | "toggle">>({});

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

  async function act(
    s: SearchRow,
    kind: "test" | "toggle",
    e: React.MouseEvent,
    request: () => Promise<Response>,
    successTitle: string,
    successDescription?: string,
  ) {
    e.stopPropagation();
    setBusy((b) => ({ ...b, [s.id]: kind }));
    try {
      const res = await request();
      if (res.ok) {
        toast({ title: successTitle, description: successDescription, tone: "success" });
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Operazione non riuscita", description: data.error, tone: "danger" });
      }
    } catch {
      toast({ title: "Operazione non riuscita", description: "Controlla la connessione e riprova.", tone: "danger" });
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[s.id];
        return next;
      });
    }
  }

  function toggleStatus(s: SearchRow, e: React.MouseEvent) {
    if (s.status === "draft" && !s.listId) return;
    const nextStatus = s.status === "active" ? "paused" : "active";
    return act(
      s,
      "toggle",
      e,
      () =>
        fetch(`/api/searches/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }),
      nextStatus === "active" ? "Ricerca attivata" : "Ricerca messa in pausa",
    );
  }

  function runTest(s: SearchRow, e: React.MouseEvent) {
    return act(
      s,
      "test",
      e,
      () => fetch(`/api/searches/${s.id}/test`, { method: "POST" }),
      "Test accodato",
      "Controlla Logs tra qualche secondo per l'esito.",
    );
  }

  // Le ricerche "una tantum" restano "attive" per sempre dopo la prima esecuzione (nessuna
  // ricorrenza da riprendere con Attiva/Pausa) — per rilanciarle serve un'azione diretta, non il
  // toggle di stato.
  function runOnce(s: SearchRow, e: React.MouseEvent) {
    return act(
      s,
      "toggle",
      e,
      () => fetch(`/api/searches/${s.id}/run`, { method: "POST" }),
      "Ricerca accodata",
      "L'esito comparirà nello storico esecuzioni.",
    );
  }

  const counts = useMemo(
    () => ({
      all: searches.length,
      active: searches.filter((s) => s.status === "active").length,
      paused: searches.filter((s) => s.status === "paused").length,
      draft: searches.filter((s) => s.status === "draft").length,
    }),
    [searches],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return searches.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.areaLabel.toLowerCase().includes(q) ||
          placeTypeLabel(s.categoryPlaceType).toLowerCase().includes(q)),
    );
  }, [searches, filter, query]);

  const newSearchButton = (
    <Link href="/ricerche/new" className={buttonVariants({ variant: "default" })}>
      <Plus weight="bold" aria-hidden />
      Nuova ricerca
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Ricerche"
        description="Ogni ricerca incrocia una zona e una categoria di Google Places, con la sua frequenza di esecuzione."
        actions={newSearchButton}
      />

      <div className="rise mb-4 flex flex-wrap items-center justify-between gap-3" style={{ "--i": 1 } as React.CSSProperties}>
        <Segmented<Filter>
          label="Filtra per stato"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tutte", count: counts.all },
            { value: "active", label: "Attive", count: counts.active },
            { value: "paused", label: "In pausa", count: counts.paused },
            { value: "draft", label: "Bozze", count: counts.draft },
          ]}
        />
        <div className="relative w-full sm:w-64">
          <MagnifyingGlass
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft"
          />
          <input
            type="search"
            aria-label="Cerca tra le ricerche"
            placeholder="Cerca titolo, zona, categoria…"
            className={cn(inputClass, "pl-9")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="Caricamento" className="grid gap-2 rounded-lg border border-border bg-card p-4 shadow-panel">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card">
          <EmptyState
            icon={MagnifyingGlass}
            title="Nessuna ricerca ancora"
            description="Una ricerca trova nuove attività in una zona. Parti dalla prima: scegli un comune e una categoria."
            action={newSearchButton}
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card">
          <EmptyState
            icon={MagnifyingGlass}
            title="Nessun risultato"
            description="Nessuna ricerca corrisponde ai filtri attuali."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Azzera i filtri
              </Button>
            }
          />
        </div>
      ) : (
        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Ricerca</Th>
                <Th>Zona</Th>
                <Th>Frequenza</Th>
                <Th>Stato</Th>
                <Th className="text-right">Azioni</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const rowBusy = busy[s.id];
                const needsList = !s.listId;
                return (
                  <Tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/ricerche/${s.id}`)}>
                    <Td className="max-w-[260px]">
                      <Link
                        href={`/ricerche/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-sm font-medium hover:text-brand"
                        title={s.title}
                      >
                        {s.title}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-muted-soft">{placeTypeLabel(s.categoryPlaceType)}</div>
                    </Td>
                    <Td className="max-w-[220px] truncate text-muted-foreground" title={s.areaLabel}>
                      {s.areaLabel}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{FREQ_LABEL[s.frequency]}</Td>
                    <Td>
                      <SearchStatusBadge status={s.status} />
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          loading={rowBusy === "test"}
                          disabled={!!rowBusy}
                          onClick={(e) => runTest(s, e)}
                          title="Esegue una prova ridotta della ricerca"
                        >
                          {rowBusy !== "test" && <Flask aria-hidden />}
                          Test
                        </Button>
                        {s.frequency === "once" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={rowBusy === "toggle"}
                            disabled={needsList || !!rowBusy}
                            onClick={(e) => runOnce(s, e)}
                            title={needsList ? "Collega prima una lista di destinazione" : undefined}
                          >
                            {rowBusy !== "toggle" && <Play weight="fill" aria-hidden />}
                            {s.status === "active" ? "Esegui di nuovo" : "Esegui"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={rowBusy === "toggle"}
                            disabled={(s.status === "draft" && needsList) || !!rowBusy}
                            onClick={(e) => toggleStatus(s, e)}
                            title={s.status === "draft" && needsList ? "Collega prima una lista di destinazione" : undefined}
                          >
                            {rowBusy !== "toggle" &&
                              (s.status === "active" ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />)}
                            {s.status === "active" ? "Pausa" : "Attiva"}
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="num mt-3 text-xs text-muted-soft">
            {visible.length === searches.length
              ? `${searches.length} ricerche`
              : `${visible.length} di ${searches.length} ricerche`}
          </p>
        </div>
      )}
    </>
  );
}
