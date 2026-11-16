"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CaretUpDown,
  Check,
  ListBullets,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Trash,
  X,
} from "@phosphor-icons/react";
import { NewListDrawer } from "@/components/liste/new-list-drawer";
import { AttributesPanel, type ListAttribute } from "@/components/liste/attributes-panel";
import type { DeliveryRules } from "@/lib/deliveryRules";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton, PageSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { DeliveryBadge } from "@/components/status-badges";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface ListOverview {
  id: string;
  name: string;
  searchNames: string;
  total: number;
  newCount: number;
  deliveredCount: number;
  failedCount: number;
  excludedCount: number;
}

interface ListDetail {
  id: string;
  name: string;
  searchNames: string;
  visibleFields: string[];
  attributes: ListAttribute[];
  deliveryRules: DeliveryRules | null;
  excludeChainsThreshold: number | null;
  aiAnalysisEnabled: boolean;
  aiPromptMd: string | null;
  aiVisionEnabled: boolean;
  outboundWebhookUrl: string | null;
  hasOutboundWebhookSecret: boolean;
  outboundFields: string[] | null;
}

interface PlaceRow {
  id: string;
  name: string;
  address: string;
  deliveryStatus: string;
  previewOnly: boolean;
  crmStatus: string | null;
  values: string[];
}

type StatusFilter = "all" | "pending" | "delivered" | "failed" | "excluded";

export default function ListePage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [lists, setLists] = useState<ListOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [columns, setColumns] = useState<{ key: string; label: string }[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [newListOpen, setNewListOpen] = useState(false);
  const [attrsOpen, setAttrsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/lists");
    const data = await res.json();
    setLists(data.lists ?? []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(
    async (id: string, p = 1, status = "all") => {
      const params = new URLSearchParams({ page: String(p), pageSize: "25", deliveryStatus: status });
      if (sortBy) {
        params.set("sortBy", sortBy);
        params.set("sortDir", sortDir);
      }
      const [detailRes, placesRes] = await Promise.all([
        fetch(`/api/lists/${id}`),
        fetch(`/api/lists/${id}/places?${params.toString()}`),
      ]);
      const detailData = await detailRes.json();
      const placesData = await placesRes.json();
      setDetail({
        id: detailData.list.id,
        name: detailData.list.name,
        searchNames: detailData.list.searchNames,
        visibleFields: detailData.list.visibleFields ?? [],
        attributes: detailData.list.attributes ?? [],
        deliveryRules: detailData.list.deliveryRules ?? null,
        excludeChainsThreshold: detailData.list.excludeChainsThreshold ?? null,
        aiAnalysisEnabled: !!detailData.list.aiAnalysisEnabled,
        aiPromptMd: detailData.list.aiPromptMd ?? null,
        aiVisionEnabled: !!detailData.list.aiVisionEnabled,
        outboundWebhookUrl: detailData.list.outboundWebhookUrl ?? null,
        hasOutboundWebhookSecret: !!detailData.list.hasOutboundWebhookSecret,
        outboundFields: detailData.list.outboundFields ?? null,
      });
      setNameDraft(detailData.list.name);
      setColumns(placesData.visibleColumns ?? []);
      setPlaces(placesData.places ?? []);
      setTotalPages(placesData.totalPages ?? 1);
      setTotal(placesData.total ?? 0);
      setSelectedRows(new Set());
    },
    [sortBy, sortDir],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati iniziali al mount
    loadOverview();
    // Torna dalla pagina di dettaglio di un'entry con la stessa lista già selezionata.
    const listFromUrl = new URLSearchParams(window.location.search).get("list");
    if (listFromUrl) setSelectedId(listFromUrl);
  }, [loadOverview]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dettaglio al cambio selezione/pagina/filtro
    if (selectedId) loadDetail(selectedId, page, statusFilter);
  }, [selectedId, page, statusFilter, loadDetail]);

  function openList(id: string) {
    setSelectedId(id);
    setPage(1);
    setStatusFilter("all");
    setAttrsOpen(false);
  }

  function backToOverview() {
    setSelectedId(null);
    setDetail(null);
    loadOverview();
  }

  async function renameList() {
    if (!detail || !nameDraft.trim() || nameDraft === detail.name) {
      setRenaming(false);
      return;
    }
    await fetch(`/api/lists/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft.trim() }),
    });
    setRenaming(false);
    toast({ title: "Lista rinominata", tone: "success" });
    loadDetail(detail.id, page, statusFilter);
  }

  async function deleteList() {
    if (!detail) return;
    const ok = await confirm({
      title: `Eliminare la lista "${detail.name}"?`,
      description: `Verranno eliminati anche tutti i ${total.toLocaleString("it-IT")} risultati contenuti. L'azione non è reversibile.`,
      confirmLabel: "Elimina lista",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`/api/lists/${detail.id}`, { method: "DELETE" });
    toast({ title: "Lista eliminata", tone: "success" });
    backToOverview();
  }

  function toggleRow(id: string) {
    setSelectedRows((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRows() {
    setSelectedRows((s) => (s.size === places.length ? new Set() : new Set(places.map((p) => p.id))));
  }

  function toggleSort(key: string) {
    setPage(1);
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortBy(null);
    }
  }

  async function deletePlace(p: PlaceRow) {
    const ok = await confirm({
      title: "Eliminare questo risultato?",
      description: p.name,
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`/api/places/${p.id}`, { method: "DELETE" });
    toast({ title: "Risultato eliminato", tone: "success" });
    if (detail) loadDetail(detail.id, page, statusFilter);
  }

  async function deleteSelected() {
    if (selectedRows.size === 0) return;
    const ok = await confirm({
      title: `Eliminare ${selectedRows.size} risultati selezionati?`,
      description: "L'azione non è reversibile.",
      confirmLabel: `Elimina ${selectedRows.size}`,
      tone: "danger",
    });
    if (!ok) return;
    await fetch("/api/places", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedRows] }),
    });
    toast({ title: `${selectedRows.size} risultati eliminati`, tone: "success" });
    if (detail) loadDetail(detail.id, page, statusFilter);
  }

  /* ───────────────────────── Dettaglio lista ───────────────────────── */
  if (selectedId) {
    if (!detail) return <PageSkeleton rows={8} />;
    const overview = lists.find((l) => l.id === selectedId);

    const sortLabel = (key: string): "ascending" | "descending" | "none" =>
      sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

    return (
      <>
        <PageHeader
          back={{ label: "Tutte le liste", onClick: backToOverview }}
          title={
            renaming ? (
              <span className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  aria-label="Nome della lista"
                  className="h-10 w-72 max-w-full rounded-md border border-input bg-card px-3 text-xl font-semibold tracking-tight focus-visible:border-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand/20"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameList();
                    if (e.key === "Escape") {
                      setRenaming(false);
                      setNameDraft(detail.name);
                    }
                  }}
                />
                <Button size="icon" variant="default" onClick={renameList} aria-label="Salva il nome">
                  <Check weight="bold" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Annulla"
                  onClick={() => {
                    setRenaming(false);
                    setNameDraft(detail.name);
                  }}
                >
                  <X weight="bold" />
                </Button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {detail.name}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRenaming(true)}
                  aria-label="Rinomina la lista"
                  title="Rinomina"
                >
                  <PencilSimple />
                </Button>
              </span>
            )
          }
          description={detail.searchNames}
          actions={
            <>
              <Button variant="outline" onClick={() => setAttrsOpen(true)}>
                <SlidersHorizontal aria-hidden />
                Configura
              </Button>
              <Button variant="danger" onClick={deleteList}>
                <Trash aria-hidden />
                Elimina
              </Button>
            </>
          }
        />

        <div className="rise mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3" style={{ "--i": 1 } as React.CSSProperties}>
          <Segmented<StatusFilter>
            label="Filtra per stato di consegna"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Tutti", count: overview?.total },
              { value: "pending", label: "Nuovi", count: overview?.newCount },
              { value: "delivered", label: "Consegnati", count: overview?.deliveredCount },
              { value: "failed", label: "Falliti", count: overview?.failedCount },
              { value: "excluded", label: "Esclusi", count: overview?.excludedCount },
            ]}
          />
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2" role="status">
              <span className="num text-[13px] text-muted-foreground">{selectedRows.size} selezionati</span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedRows(new Set())}>
                Deseleziona
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected}>
                <Trash aria-hidden />
                Elimina
              </Button>
            </div>
          )}
        </div>

        {places.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input bg-card">
            <EmptyState
              icon={ListBullets}
              title="Nessun risultato"
              description={
                statusFilter === "all"
                  ? "Questa lista non contiene ancora risultati. Compariranno dopo la prima esecuzione di una ricerca collegata."
                  : "Nessun risultato con questo stato di consegna."
              }
              action={
                statusFilter !== "all" ? (
                  <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
                    Mostra tutti
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <Table minWidth={560 + columns.length * 150}>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleziona tutti i risultati della pagina"
                      checked={places.length > 0 && selectedRows.size === places.length}
                      onChange={toggleAllRows}
                    />
                  </Th>
                  <Th>Attività</Th>
                  {columns.map((c) => (
                    <Th key={c.key} aria-sort={sortLabel(c.key)}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        title={`Ordina per ${c.label}`}
                        className="group inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground"
                      >
                        {c.label}
                        {sortBy === c.key ? (
                          sortDir === "desc" ? (
                            <ArrowDown size={12} weight="bold" className="text-brand" aria-hidden />
                          ) : (
                            <ArrowUp size={12} weight="bold" className="text-brand" aria-hidden />
                          )
                        ) : (
                          <CaretUpDown size={12} className="opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                        )}
                      </button>
                    </Th>
                  ))}
                  <Th>Consegna</Th>
                  <Th className="w-10">
                    <span className="sr-only">Azioni</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <Tr key={p.id} data-selected={selectedRows.has(p.id)}>
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Seleziona ${p.name}`}
                        checked={selectedRows.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                      />
                    </Td>
                    <Td className="max-w-[300px]">
                      <Link
                        href={`/liste/${detail.id}/${p.id}`}
                        className="block truncate text-sm font-medium hover:text-brand"
                        title={p.name}
                      >
                        {p.name}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-muted-soft">{p.address}</div>
                    </Td>
                    {p.values.map((v, i) => (
                      <Td key={i} className="num max-w-[200px] truncate text-muted-foreground" title={v}>
                        {v}
                      </Td>
                    ))}
                    <Td>
                      <div className="grid justify-items-start gap-1">
                        <DeliveryBadge status={p.deliveryStatus} previewOnly={p.previewOnly} />
                        {p.crmStatus === "review" && <span className="text-xs text-muted-foreground">CRM · Da verificare</span>}
                        {p.crmStatus === "failed" && <span className="text-xs text-destructive-fg">CRM · Errore</span>}
                      </div>
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deletePlace(p)}
                        aria-label={`Elimina ${p.name}`}
                        title="Elimina"
                        className="hover:text-destructive-fg"
                      >
                        <Trash />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} total={total} noun="risultati" onPage={setPage} />
          </div>
        )}

        <Drawer
          open={attrsOpen}
          onClose={() => setAttrsOpen(false)}
          width={720}
          title="Configura lista"
          description={detail.name}
        >
          <AttributesPanel
            listId={detail.id}
            attributes={detail.attributes}
            visibleFields={detail.visibleFields}
            deliveryRules={detail.deliveryRules}
            excludeChainsThreshold={detail.excludeChainsThreshold}
            aiAnalysisEnabled={detail.aiAnalysisEnabled}
            aiPromptMd={detail.aiPromptMd}
            aiVisionEnabled={detail.aiVisionEnabled}
            outboundWebhookUrl={detail.outboundWebhookUrl}
            hasOutboundWebhookSecret={detail.hasOutboundWebhookSecret}
            outboundFields={detail.outboundFields}
            onChanged={() => loadDetail(detail.id, page, statusFilter)}
          />
        </Drawer>
      </>
    );
  }

  /* ───────────────────────── Panoramica liste ───────────────────────── */
  const newListButton = (
    <Button onClick={() => setNewListOpen(true)}>
      <Plus weight="bold" aria-hidden />
      Nuova lista
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Liste"
        description="Una lista raccoglie i risultati di una o più ricerche. Qui ne configuri campi, filtri e consegna."
        actions={newListButton}
      />

      {loading ? (
        <div role="status" aria-label="Caricamento" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card">
          <EmptyState
            icon={ListBullets}
            title="Nessuna lista ancora"
            description="Creane una a mano, oppure eseguine una da un test in Ricerche: verrà creata in automatico."
            action={newListButton}
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((l, i) => {
            const parts = [
              { key: "delivered", label: "consegnati", value: l.deliveredCount, className: "bg-success", text: "text-success-fg" },
              { key: "new", label: "nuovi", value: l.newCount, className: "bg-brand", text: "text-brand" },
              { key: "failed", label: "falliti", value: l.failedCount, className: "bg-destructive", text: "text-destructive-fg" },
              { key: "excluded", label: "esclusi", value: l.excludedCount, className: "bg-warning", text: "text-warning-fg" },
            ];
            const sum = parts.reduce((s, p) => s + p.value, 0);
            return (
              <li key={l.id} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => openList(l.id)}
                  className="group flex h-full w-full flex-col rounded-lg border border-border bg-card p-5 text-left shadow-panel transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-foreground/20 hover:shadow-pop active:scale-[0.995]"
                >
                  <div className="truncate text-[15px] font-semibold tracking-tight group-hover:text-brand">{l.name}</div>
                  <div className="mt-0.5 line-clamp-1 min-h-4 text-xs text-muted-soft">{l.searchNames || "Nessuna ricerca collegata"}</div>

                  <div className="num mt-5 text-[28px] font-semibold leading-none tracking-[-0.025em]">
                    {l.total.toLocaleString("it-IT")}
                    <span className="ml-1.5 text-[13px] font-normal tracking-normal text-muted-foreground">risultati</span>
                  </div>

                  <div
                    role="img"
                    aria-label={`Stato dei risultati: ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}`}
                    className="mt-4 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
                  >
                    {sum > 0 &&
                      parts
                        .filter((p) => p.value > 0)
                        .map((p) => (
                          <div
                            key={p.key}
                            className={cn("h-full min-w-1", p.className)}
                            style={{ flexGrow: (p.value / sum) * 100, flexBasis: 0 }}
                          />
                        ))}
                  </div>
                  <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                    {parts
                      .filter((p) => p.value > 0)
                      .map((p) => (
                        <li key={p.key}>
                          <span className={cn("num font-semibold", p.text)}>{p.value.toLocaleString("it-IT")}</span> {p.label}
                        </li>
                      ))}
                  </ul>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NewListDrawer open={newListOpen} onClose={() => setNewListOpen(false)} onCreated={loadOverview} />
    </>
  );
}
