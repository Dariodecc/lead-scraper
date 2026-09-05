"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Field, inputClass, selectClass } from "@/components/ui/field";
import { AreaAutocomplete, type AreaValue } from "@/components/ricerche/area-autocomplete";
import { PLACE_TYPES } from "@/lib/placeTypes";

const WEEKDAYS = [
  { id: 1, label: "Lunedì" },
  { id: 2, label: "Martedì" },
  { id: 3, label: "Mercoledì" },
  { id: 4, label: "Giovedì" },
  { id: 5, label: "Venerdì" },
  { id: 6, label: "Sabato" },
  { id: 0, label: "Domenica" },
];

const STATUS_LABEL: Record<string, string> = { draft: "Bozza", active: "Attiva", paused: "In pausa" };
const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  draft: "bg-muted text-muted-foreground",
};

interface ListSummary {
  id: string;
  name: string;
}

interface RunRow {
  id: string;
  startedAt: string;
  status: string;
  resultsCount: number;
  newCount: number;
  duplicateCount: number;
}

interface CostSummary {
  totalUsd: number;
  googleApiUsd: number;
  aiAnalysisUsd: number;
  callCount: number;
}

function emptyDraft() {
  return {
    title: "",
    area: null as AreaValue | null,
    radiusKm: 15,
    categoryPlaceType: "",
    frequency: "monthly" as "once" | "weekly" | "monthly",
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: "07:00",
    listId: "",
  };
}

function formatUsd(v: number) {
  return `$${v.toFixed(4)}`;
}

export default function SearchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";

  const [draft, setDraft] = useState(emptyDraft());
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  const load = useCallback(async () => {
    const listsRes = await fetch("/api/lists");
    const listsData = await listsRes.json();
    setLists((listsData.lists ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));

    if (!isNew) {
      const res = await fetch(`/api/searches/${params.id}`);
      const data = await res.json();
      const s = data.search;
      setDraft({
        title: s.title,
        area: { placeId: s.areaPlaceId, label: s.areaLabel, lat: Number(s.areaLat), lng: Number(s.areaLng) },
        radiusKm: Math.round(s.areaRadiusM / 1000),
        categoryPlaceType: s.categoryPlaceType,
        frequency: s.frequency,
        dayOfWeek: s.scheduleDayOfWeek ?? 1,
        dayOfMonth: s.scheduleDayOfMonth ?? 1,
        time: s.scheduleTime ?? "07:00",
        listId: s.listId ?? "",
      });
      setStatus(s.status);
      setRuns(s.runs ?? []);
      setCostSummary(data.costSummary ?? null);
    }
    setLoaded(true);
  }, [isNew, params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  const selectedList = lists.find((l) => l.id === draft.listId) ?? null;

  async function handleSave() {
    if (!draft.area || !draft.categoryPlaceType) {
      alert("Seleziona zona e categoria prima di salvare");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: draft.title.trim() || "Nuova ricerca",
        areaPlaceId: draft.area.placeId,
        areaLabel: draft.area.label,
        areaLat: draft.area.lat,
        areaLng: draft.area.lng,
        areaRadiusM: draft.radiusKm * 1000,
        categoryPlaceType: draft.categoryPlaceType,
        categoryLabel: PLACE_TYPES.find((t) => t.id === draft.categoryPlaceType)?.label,
        frequency: draft.frequency,
        scheduleDayOfWeek: draft.frequency === "weekly" ? draft.dayOfWeek : null,
        scheduleDayOfMonth: draft.frequency === "monthly" ? draft.dayOfMonth : null,
        scheduleTime: draft.frequency === "once" ? null : draft.time,
        listId: draft.listId || null,
      };

      const res = await fetch(isNew ? "/api/searches" : `/api/searches/${params.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Errore nel salvataggio");
        return;
      }
      if (isNew) {
        router.push(`/ricerche/${data.search.id}`);
      } else {
        setMessage("Salvato ✓");
        setTimeout(() => setMessage(null), 1800);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (isNew) return;
    setTesting(true);
    setMessage("Esecuzione in corso…");
    try {
      const res = await fetch(`/api/searches/${params.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Errore nel TEST");
        return;
      }
      setMessage("TEST accodato — controlla Logs tra qualche secondo per l'esito.");
      load();
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleStatus() {
    if (isNew) return;
    const nextStatus = status === "active" ? "paused" : "active";
    const res = await fetch(`/api/searches/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Errore");
      return;
    }
    setStatus(nextStatus);
  }

  if (!loaded) return <div className="px-12 pb-12 pt-10 text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <div className="px-12 pb-12 pt-10">
      <button className="mb-2.5 p-0 text-[13px] text-muted-foreground" onClick={() => router.push("/ricerche")}>
        ← Torna a Ricerche
      </button>
      <div className="mb-1.5 flex items-center gap-3">
        <input
          className="text-[28px] font-semibold tracking-tight focus:outline-none"
          placeholder="Nuova ricerca"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
        {!isNew && (
          <span className={`w-fit rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        Zona e categoria da Google Places, frequenza e lista di destinazione
      </p>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-3.5 text-[13px] font-semibold">Dati</div>

          <Field label="Zona (Google Places)">
            <AreaAutocomplete value={draft.area} onChange={(area) => setDraft((d) => ({ ...d, area }))} />
          </Field>

          <Field label="Raggio di copertura (km)">
            <input
              type="number"
              min={1}
              max={50}
              className={inputClass}
              value={draft.radiusKm}
              onChange={(e) => setDraft((d) => ({ ...d, radiusKm: Number(e.target.value) }))}
            />
            <div className="mt-1.5 text-xs text-muted-soft">
              Google restituisce al massimo 20 risultati a chiamata: l&apos;area viene coperta con
              più chiamate (a griglia, con suddivisione automatica nelle zone dense).
            </div>
          </Field>

          <Field label="Categoria commerciale (Place Type)">
            <select
              className={selectClass}
              value={draft.categoryPlaceType}
              onChange={(e) => setDraft((d) => ({ ...d, categoryPlaceType: e.target.value }))}
            >
              <option value="">Seleziona una categoria…</option>
              {PLACE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Frequenza">
            <div className="flex gap-2 rounded-full bg-background p-1.5">
              {(["once", "weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`flex-1 rounded-full px-2.5 py-2 text-[13px] font-medium ${
                    draft.frequency === f ? "bg-muted shadow-sm" : "text-muted-foreground"
                  }`}
                  onClick={() => setDraft((d) => ({ ...d, frequency: f }))}
                >
                  {f === "once" ? "Una tantum" : f === "weekly" ? "Settimanale" : "Mensile"}
                </button>
              ))}
            </div>
          </Field>

          {draft.frequency === "weekly" && (
            <Field label="Giorno della settimana">
              <select
                className={selectClass}
                value={draft.dayOfWeek}
                onChange={(e) => setDraft((d) => ({ ...d, dayOfWeek: Number(e.target.value) }))}
              >
                {WEEKDAYS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {draft.frequency === "monthly" && (
            <Field label="Giorno del mese">
              <input
                type="number"
                min={1}
                max={31}
                className={inputClass}
                value={draft.dayOfMonth}
                onChange={(e) => setDraft((d) => ({ ...d, dayOfMonth: Number(e.target.value) }))}
              />
            </Field>
          )}
          {draft.frequency !== "once" && (
            <Field label="Ora di partenza (Europe/Rome)">
              <input
                type="time"
                className={inputClass}
                value={draft.time}
                onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              />
            </Field>
          )}

          <div className="mb-1 border-t border-border pt-5">
            <Field label="Lista di destinazione">
              <select
                className={selectClass}
                value={draft.listId}
                onChange={(e) => setDraft((d) => ({ ...d, listId: e.target.value }))}
              >
                <option value="">Nessuna — verrà creata al primo TEST</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="text-xs text-muted-soft">
              {selectedList ? (
                <>
                  Webhook, prompt AI e filtri di invio si configurano nella lista collegata →{" "}
                  <a className="underline" href={`/liste?list=${selectedList.id}`}>
                    vai a &ldquo;{selectedList.name}&rdquo;
                  </a>
                </>
              ) : (
                "Webhook, prompt AI e filtri di invio si configurano nella lista di destinazione."
              )}
            </div>
          </div>

          {message && <div className="mb-3 mt-4 text-xs text-muted-foreground">{message}</div>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isNew ? "Crea ricerca" : "Salva modifiche"}
            </button>
            {!isNew && (
              <>
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTest}
                  className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold disabled:opacity-60"
                >
                  {testing ? "In corso…" : "Esegui TEST"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={status === "draft" && !draft.listId}
                  className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold disabled:opacity-40"
                >
                  {status === "active" ? "Pausa" : "Attiva"}
                </button>
              </>
            )}
          </div>
        </div>

        {!isNew && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-muted p-5">
              <div className="mb-3.5 text-[13px] font-semibold">Costi API di questa ricerca</div>
              {costSummary ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Totale</span>
                    <span className="font-semibold">{formatUsd(costSummary.totalUsd)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Google Places API</span>
                    <span>{formatUsd(costSummary.googleApiUsd)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Analisi AI (OpenAI)</span>
                    <span>{formatUsd(costSummary.aiAnalysisUsd)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Chiamate totali</span>
                    <span>{costSummary.callCount}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-soft">Nessun costo registrato ancora</div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-muted p-5">
              <div className="mb-3.5 text-[13px] font-semibold">Storico esecuzioni</div>
              {runs.length === 0 && <div className="text-xs text-muted-soft">Nessuna esecuzione ancora</div>}
              <div className="flex flex-col gap-2.5">
                {runs.map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-background p-3">
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-[13px] font-medium">
                        {new Date(r.startedAt).toLocaleString("it-IT")}
                      </span>
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                          r.status === "done"
                            ? "bg-success/10 text-success"
                            : r.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.status === "done" ? "Completata" : r.status === "failed" ? "Errore" : "In corso"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.resultsCount} risultati · {r.newCount} nuovi · {r.duplicateCount} duplicati
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
