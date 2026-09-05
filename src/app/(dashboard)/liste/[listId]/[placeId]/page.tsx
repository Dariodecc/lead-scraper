"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { inputClass, selectClass } from "@/components/ui/field";
import {
  WEBSITE_STATUS_LABEL,
  BUCKET_LABEL,
  CONFIDENCE_LABEL,
  DELIVERY_STATUS_LABEL,
  BUSINESS_STATUS_LABEL,
} from "@/lib/placeFields";

interface PlaceDetail {
  id: string;
  listId: string;
  businessName: string;
  category: string | null;
  address: string;
  phone: string | null;
  websiteUrl: string | null;
  websiteStatus: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  confirmedOpeningDate: string | null;
  deliveryStatus: string;
  customAttributes: Record<string, unknown>;
}

interface ListAttribute {
  id: string;
  name: string;
  key: string;
  type: string;
}

interface LogRow {
  id: string;
  level: string;
  category: string;
  message: string;
  createdAt: string;
}

const PRICE_LABEL: Record<number, string> = {
  1: "€ — economico",
  2: "€€ — medio",
  3: "€€€ — alto",
  4: "€€€€ — molto alto",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  delivered: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  excluded: "bg-warning/10 text-warning",
  pending: "bg-muted text-muted-foreground",
};

const LEVEL_STYLE: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-hairline-soft pb-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px]">{value}</span>
    </div>
  );
}

function CustomValueInput({
  attribute,
  value,
  onSave,
}: {
  attribute: ListAttribute;
  value: unknown;
  onSave: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saved, setSaved] = useState(false);

  function commit() {
    let parsed: unknown = draft;
    if (attribute.type === "number") parsed = draft.trim() ? Number(draft) : null;
    if (attribute.type === "boolean") parsed = draft === "true";
    onSave(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  if (attribute.type === "boolean") {
    return (
      <select
        className={selectClass}
        value={draft || "false"}
        onChange={(e) => {
          setDraft(e.target.value);
          onSave(e.target.value === "true");
        }}
      >
        <option value="true">Sì</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type={attribute.type === "number" ? "number" : attribute.type === "date" ? "date" : "text"}
        className={`${inputClass} flex-1`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {saved && <span className="text-xs text-success">Salvato ✓</span>}
    </div>
  );
}

export default function PlaceDetailPage() {
  const router = useRouter();
  const params = useParams<{ listId: string; placeId: string }>();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [listName, setListName] = useState("");
  const [attributes, setAttributes] = useState<ListAttribute[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const load = useCallback(async () => {
    const [placeRes, listRes, logsRes] = await Promise.all([
      fetch(`/api/places/${params.placeId}`),
      fetch(`/api/lists/${params.listId}`),
      fetch(`/api/logs?placeId=${params.placeId}&pageSize=50`),
    ]);
    const placeData = await placeRes.json();
    const listData = await listRes.json();
    const logsData = await logsRes.json();
    setPlace(placeData.place);
    setListName(listData.list?.name ?? "");
    setAttributes(listData.list?.attributes ?? []);
    setLogs(logsData.logs ?? []);
  }, [params.placeId, params.listId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  async function saveCustomValue(listAttributeId: string, value: unknown) {
    await fetch(`/api/places/${params.placeId}/custom-values`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listAttributeId, value }),
    });
    load();
  }

  if (!place) return <div className="px-12 pb-12 pt-10 text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <div className="px-12 pb-12 pt-10">
      <button
        className="mb-2.5 p-0 text-[13px] text-muted-foreground"
        onClick={() => router.push(`/liste?list=${params.listId}`)}
      >
        ← Torna a {listName || "lista"}
      </button>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight">{place.businessName}</h1>
        <span
          className={`w-fit rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[place.deliveryStatus] ?? "bg-muted text-muted-foreground"}`}
        >
          {DELIVERY_STATUS_LABEL[place.deliveryStatus]}
        </span>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        {place.category ?? "—"} · {place.address}
      </p>

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-muted p-5">
            <div className="mb-3.5 text-[13px] font-semibold">Dati</div>
            <div className="flex flex-col gap-3.5">
              <Row label="Telefono" value={<span className="font-mono">{place.phone ?? "—"}</span>} />
              <Row
                label="URL sito"
                value={
                  place.websiteUrl ? (
                    <a
                      href={place.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[220px] truncate underline"
                      title={place.websiteUrl}
                    >
                      {place.websiteUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Stato sito"
                value={
                  <span className="rounded-full bg-background px-3 py-0.5 text-xs font-medium">
                    {WEBSITE_STATUS_LABEL[place.websiteStatus] ?? place.websiteStatus}
                  </span>
                }
              />
              <Row
                label="Rating / recensioni"
                value={
                  place.rating != null ? `${place.rating}★ · ${place.reviewCount ?? 0} recensioni` : "Nessun dato"
                }
              />
              <Row
                label="Fascia di prezzo (size proxy)"
                value={place.priceLevel ? PRICE_LABEL[place.priceLevel] : "Non disponibile"}
              />
              <Row
                label="Stato attività"
                value={
                  place.businessStatus ? (
                    <span className="rounded-full bg-background px-3 py-0.5 text-xs font-medium">
                      {BUSINESS_STATUS_LABEL[place.businessStatus] ?? place.businessStatus}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Apertura stimata"
                value={
                  <span className="rounded-full bg-background px-3 py-0.5 text-xs font-semibold">
                    {BUCKET_LABEL[place.estimatedOpeningWindow]}
                  </span>
                }
              />
              <Row label="Confidenza stima" value={CONFIDENCE_LABEL[place.estimationConfidence]} />
              {place.confirmedOpeningDate && (
                <Row
                  label="Data apertura confermata"
                  value={new Date(place.confirmedOpeningDate).toLocaleDateString("it-IT")}
                />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted p-5">
            <div className="mb-1 text-[13px] font-semibold">Campi personalizzati</div>
            <div className="mb-3.5 text-xs text-muted-soft">
              Valori scritti dall&apos;analisi AI o inseriti a mano — modificabili qui.
            </div>
            {attributes.length === 0 && (
              <div className="text-xs text-muted-soft">Nessun campo custom in questa lista</div>
            )}
            <div className="flex flex-col gap-3">
              {attributes.map((a) => (
                <div key={a.id}>
                  <label className="mb-1 block text-xs font-medium text-foreground/80">{a.name}</label>
                  <CustomValueInput
                    attribute={a}
                    value={place.customAttributes[a.key]}
                    onSave={(value) => saveCustomValue(a.id, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-3.5 text-[13px] font-semibold">Log di questa entry</div>
          {logs.length === 0 && <div className="text-xs text-muted-soft">Nessun log ancora</div>}
          <div className="flex flex-col gap-2.5">
            {logs.map((l) => (
              <div key={l.id} className="rounded-md border border-border bg-background p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium ${LEVEL_STYLE[l.level]}`}>
                    {l.level}
                  </span>
                  <span className="text-[11px] text-muted-soft">
                    {new Date(l.createdAt).toLocaleString("it-IT")}
                  </span>
                </div>
                <div className="text-xs">{l.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
