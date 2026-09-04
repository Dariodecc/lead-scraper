"use client";

import { useCallback, useEffect, useState } from "react";
import { NewListDrawer } from "@/components/liste/new-list-drawer";
import { AttributesPanel, type ListAttribute } from "@/components/liste/attributes-panel";
import { PlaceDrawer } from "@/components/liste/place-drawer";
import { DELIVERY_STATUS_LABEL } from "@/lib/placeFields";

interface ListOverview {
  id: string;
  name: string;
  searchNames: string;
  total: number;
  newCount: number;
  deliveredCount: number;
  failedCount: number;
}

interface ListDetail {
  id: string;
  name: string;
  searchNames: string;
  visibleFields: string[];
  attributes: ListAttribute[];
}

interface PlaceRow {
  id: string;
  name: string;
  address: string;
  deliveryStatus: string;
  values: string[];
}

export default function ListePage() {
  const [lists, setLists] = useState<ListOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [columns, setColumns] = useState<{ key: string; label: string }[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [newListOpen, setNewListOpen] = useState(false);
  const [attrsOpen, setAttrsOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/lists");
    const data = await res.json();
    setLists(data.lists ?? []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const [detailRes, placesRes] = await Promise.all([
      fetch(`/api/lists/${id}`),
      fetch(`/api/lists/${id}/places`),
    ]);
    const detailData = await detailRes.json();
    const placesData = await placesRes.json();
    setDetail({
      id: detailData.list.id,
      name: detailData.list.name,
      searchNames: detailData.list.searchNames,
      visibleFields: detailData.list.visibleFields ?? [],
      attributes: detailData.list.attributes ?? [],
    });
    setColumns(placesData.visibleColumns ?? []);
    setPlaces(placesData.places ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati iniziali al mount
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dettaglio al cambio selezione
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  if (selectedId && detail) {
    return (
      <div className="px-12 pb-12 pt-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <button
              className="mb-2.5 p-0 text-[13px] text-muted-foreground"
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                loadOverview();
              }}
            >
              ← Tutte le liste
            </button>
            <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">{detail.name}</h1>
            <p className="text-sm text-muted-foreground">{detail.searchNames}</p>
          </div>
          <button
            className="h-10 rounded-md border border-border bg-background px-4 text-sm font-semibold"
            onClick={() => setAttrsOpen((v) => !v)}
          >
            Attributi
          </button>
        </div>

        {attrsOpen && (
          <AttributesPanel
            listId={detail.id}
            attributes={detail.attributes}
            visibleFields={detail.visibleFields}
            onChanged={() => loadDetail(detail.id)}
          />
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className="grid gap-x-4 border-b border-border bg-muted px-5 py-3"
            style={{ gridTemplateColumns: `1.8fr ${columns.map(() => "1fr").join(" ")} 1fr` }}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Attività
            </span>
            {columns.map((c) => (
              <span key={c.key} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
            ))}
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Consegna
            </span>
          </div>
          {places.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nessun risultato ancora — esegui un TEST dalla ricerca collegata.
            </div>
          )}
          {places.map((p) => (
            <div
              key={p.id}
              className="grid cursor-pointer items-center gap-x-4 border-b border-hairline-soft px-5 py-3.5"
              style={{ gridTemplateColumns: `1.8fr ${columns.map(() => "1fr").join(" ")} 1fr` }}
              onClick={() => setSelectedPlaceId(p.id)}
            >
              <span>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-soft">{p.address}</div>
              </span>
              {p.values.map((v, i) => (
                <span key={i} className="text-[13px]">
                  {v}
                </span>
              ))}
              <span
                className={`w-fit rounded-full px-3 py-0.5 text-xs font-medium ${
                  p.deliveryStatus === "delivered"
                    ? "bg-success/10 text-success"
                    : p.deliveryStatus === "failed"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {DELIVERY_STATUS_LABEL[p.deliveryStatus]}
              </span>
            </div>
          ))}
        </div>

        <PlaceDrawer placeId={selectedPlaceId} onClose={() => setSelectedPlaceId(null)} />
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
            onClick={() => setSelectedId(l.id)}
          >
            <div className="mb-1 text-base font-semibold">{l.name}</div>
            <div className="mb-4 text-xs text-muted-soft">{l.searchNames}</div>
            <div className="flex gap-4">
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
            </div>
          </div>
        ))}
      </div>

      <NewListDrawer open={newListOpen} onClose={() => setNewListOpen(false)} onCreated={loadOverview} />
    </div>
  );
}
