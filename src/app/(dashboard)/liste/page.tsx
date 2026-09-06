"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NewListDrawer } from "@/components/liste/new-list-drawer";
import { AttributesPanel, type ListAttribute } from "@/components/liste/attributes-panel";
import { DELIVERY_STATUS_LABEL } from "@/lib/placeFields";
import type { DeliveryRules } from "@/lib/deliveryRules";

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
  outboundWebhookUrl: string | null;
  hasOutboundWebhookSecret: boolean;
  outboundFields: string[] | null;
}

interface PlaceRow {
  id: string;
  name: string;
  address: string;
  deliveryStatus: string;
  values: string[];
}

const STATUS_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "pending", label: "Nuovo" },
  { value: "delivered", label: "Consegnato" },
  { value: "failed", label: "Fallito" },
  { value: "excluded", label: "Escluso" },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  delivered: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  excluded: "bg-warning/10 text-warning",
  pending: "bg-muted text-muted-foreground",
};

export default function ListePage() {
  const router = useRouter();
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/lists");
    const data = await res.json();
    setLists(data.lists ?? []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string, p = 1, status = "all") => {
    const [detailRes, placesRes] = await Promise.all([
      fetch(`/api/lists/${id}`),
      fetch(`/api/lists/${id}/places?page=${p}&pageSize=25&deliveryStatus=${status}`),
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
  }, []);

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
    loadDetail(detail.id, page, statusFilter);
  }

  async function deleteList() {
    if (!detail) return;
    if (
      !confirm(
        `Eliminare la lista "${detail.name}"? Verranno eliminati anche tutti i ${total} risultati contenuti. L'azione non è reversibile.`,
      )
    )
      return;
    await fetch(`/api/lists/${detail.id}`, { method: "DELETE" });
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

  async function deletePlace(id: string) {
    if (!confirm("Eliminare questo risultato?")) return;
    await fetch(`/api/places/${id}`, { method: "DELETE" });
    if (detail) loadDetail(detail.id, page, statusFilter);
  }

  async function deleteSelected() {
    if (selectedRows.size === 0) return;
    if (!confirm(`Eliminare ${selectedRows.size} risultati selezionati?`)) return;
    await fetch("/api/places", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedRows] }),
    });
    if (detail) loadDetail(detail.id, page, statusFilter);
  }

  if (selectedId && detail) {
    const gridTemplate = `28px 1.8fr ${columns.map(() => "1fr").join(" ")} 1fr 40px`;
    return (
      <div className="px-12 pb-12 pt-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <button className="mb-2.5 p-0 text-[13px] text-muted-foreground" onClick={backToOverview}>
              ← Tutte le liste
            </button>
            {renaming ? (
              <div className="mb-1.5 flex items-center gap-2">
                <input
                  autoFocus
                  className="h-9 rounded-md border border-border px-3 text-[22px] font-semibold tracking-tight"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && renameList()}
                />
                <button className="text-xs font-semibold underline" onClick={renameList}>
                  Salva
                </button>
                <button
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setRenaming(false);
                    setNameDraft(detail.name);
                  }}
                >
                  Annulla
                </button>
              </div>
            ) : (
              <h1
                className="mb-1.5 cursor-pointer text-[28px] font-semibold tracking-tight"
                onClick={() => setRenaming(true)}
                title="Clicca per rinominare"
              >
                {detail.name}
              </h1>
            )}
            <p className="text-sm text-muted-foreground">{detail.searchNames}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="h-10 rounded-md border border-border bg-background px-4 text-sm font-semibold"
              onClick={() => setAttrsOpen((v) => !v)}
            >
              Modifica
            </button>
            <button
              className="h-10 rounded-md border border-destructive/30 bg-background px-4 text-sm font-semibold text-destructive"
              onClick={deleteList}
            >
              Elimina lista
            </button>
          </div>
        </div>

        {attrsOpen && (
          <AttributesPanel
            listId={detail.id}
            attributes={detail.attributes}
            visibleFields={detail.visibleFields}
            deliveryRules={detail.deliveryRules}
            excludeChainsThreshold={detail.excludeChainsThreshold}
            aiAnalysisEnabled={detail.aiAnalysisEnabled}
            aiPromptMd={detail.aiPromptMd}
            outboundWebhookUrl={detail.outboundWebhookUrl}
            hasOutboundWebhookSecret={detail.hasOutboundWebhookSecret}
            outboundFields={detail.outboundFields}
            onChanged={() => loadDetail(detail.id, page, statusFilter)}
          />
        )}

        <div className="mb-4 flex items-center justify-between">
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          {selectedRows.size > 0 && (
            <button
              className="h-9 rounded-md bg-destructive px-4 text-[13px] font-semibold text-white"
              onClick={deleteSelected}
            >
              Elimina selezionati ({selectedRows.size})
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <div style={{ minWidth: 640 + columns.length * 140 }}>
            <div
              className="grid items-center gap-x-4 border-b border-border bg-muted px-5 py-3"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <input
                type="checkbox"
                checked={places.length > 0 && selectedRows.size === places.length}
                onChange={toggleAllRows}
              />
              <span className="min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attività
              </span>
              {columns.map((c) => (
                <span
                  key={c.key}
                  className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  title={c.label}
                >
                  {c.label}
                </span>
              ))}
              <span className="min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Consegna
              </span>
              <span />
            </div>
            {places.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nessun risultato con questo filtro.
              </div>
            )}
            {places.map((p) => (
              <div
                key={p.id}
                className="grid items-center gap-x-4 border-b border-hairline-soft px-5 py-3.5"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <input
                  type="checkbox"
                  checked={selectedRows.has(p.id)}
                  onChange={() => toggleRow(p.id)}
                />
                <span
                  className="min-w-0 cursor-pointer"
                  onClick={() => router.push(`/liste/${detail.id}/${p.id}`)}
                >
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-soft">{p.address}</div>
                </span>
                {p.values.map((v, i) => (
                  <span key={i} className="min-w-0 truncate text-[13px]" title={v}>
                    {v}
                  </span>
                ))}
                <span
                  className={`min-w-0 w-fit rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[p.deliveryStatus] ?? "bg-muted text-muted-foreground"}`}
                >
                  {DELIVERY_STATUS_LABEL[p.deliveryStatus]}
                </span>
                <button
                  className="text-xs text-destructive"
                  onClick={() => deletePlace(p.id)}
                  title="Elimina"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>{total} risultati totali</span>
          <div className="flex items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              ← Precedente
            </button>
            <span>
              Pagina {page} di {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Successiva →
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Liste</h1>
        <p className="text-sm text-muted-foreground">
          Configura i campi di una lista, poi collegala a una o più ricerche
        </p>
      </div>
      <button
        className="mb-5 h-10 rounded-md bg-primary px-4.5 text-sm font-semibold text-primary-foreground"
        onClick={() => setNewListOpen(true)}
      >
        + Nuova lista
      </button>

      {!loading && lists.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Nessuna lista ancora — creane una, oppure eseguine una da un TEST in Ricerche.
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {lists.map((l) => (
          <div
            key={l.id}
            className="cursor-pointer rounded-xl border border-border p-5"
            onClick={() => openList(l.id)}
          >
            <div className="mb-1 text-base font-semibold">{l.name}</div>
            <div className="mb-4 text-xs text-muted-soft">{l.searchNames}</div>
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-xl font-semibold">{l.total}</div>
                <div className="text-[11px] text-muted-soft">totali</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-success">{l.newCount}</div>
                <div className="text-[11px] text-muted-soft">nuovi</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-destructive">{l.failedCount}</div>
                <div className="text-[11px] text-muted-soft">falliti</div>
              </div>
              {l.excludedCount > 0 && (
                <div>
                  <div className="text-xl font-semibold text-warning">{l.excludedCount}</div>
                  <div className="text-[11px] text-muted-soft">esclusi</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <NewListDrawer open={newListOpen} onClose={() => setNewListOpen(false)} onCreated={loadOverview} />
    </div>
  );
}
