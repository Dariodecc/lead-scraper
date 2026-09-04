"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Field, inputClass, selectClass } from "@/components/ui/field";
import { AreaAutocomplete, type AreaValue } from "./area-autocomplete";
import { PLACE_TYPES } from "@/lib/placeTypes";
import { FIXED_PLACE_FIELDS } from "@/lib/placeFields";

const WEEKDAYS = [
  { id: 1, label: "Lunedì" },
  { id: 2, label: "Martedì" },
  { id: 3, label: "Mercoledì" },
  { id: 4, label: "Giovedì" },
  { id: 5, label: "Venerdì" },
  { id: 6, label: "Sabato" },
  { id: 0, label: "Domenica" },
];

export interface ListSummary {
  id: string;
  name: string;
  attributes: { id: string; name: string; key: string }[];
}

export interface SearchRecord {
  id: string;
  title: string;
  areaPlaceId: string;
  areaLabel: string;
  areaLat: number;
  areaLng: number;
  areaRadiusM: number;
  categoryPlaceType: string;
  frequency: "once" | "weekly" | "monthly";
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  scheduleTime: string | null;
  listId: string | null;
  outboundWebhookUrl: string | null;
  outboundFields: string[] | null;
  status: "draft" | "active" | "paused";
  runs?: {
    id: string;
    startedAt: string;
    status: string;
    resultsCount: number;
    newCount: number;
    duplicateCount: number;
  }[];
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
    outboundWebhookUrl: "",
    outboundWebhookSecret: "",
    outboundFields: [] as string[],
  };
}

export function SearchDrawer({
  open,
  search,
  lists,
  onClose,
  onSaved,
}: {
  open: boolean;
  search: SearchRecord | null;
  lists: ListSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    // Reinizializza il form quando cambia la ricerca in modifica (drawer riaperto su un'altra riga).
    if (search) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({
        title: search.title,
        area: { placeId: search.areaPlaceId, label: search.areaLabel, lat: search.areaLat, lng: search.areaLng },
        radiusKm: Math.round(search.areaRadiusM / 1000),
        categoryPlaceType: search.categoryPlaceType,
        frequency: search.frequency,
        dayOfWeek: search.scheduleDayOfWeek ?? 1,
        dayOfMonth: search.scheduleDayOfMonth ?? 1,
        time: search.scheduleTime ?? "07:00",
        listId: search.listId ?? "",
        outboundWebhookUrl: search.outboundWebhookUrl ?? "",
        outboundWebhookSecret: "",
        outboundFields: search.outboundFields ?? [],
      });
    } else {
      setDraft(emptyDraft());
    }
    setTestMessage(null);
  }, [search, open]);

  const selectedList = lists.find((l) => l.id === draft.listId) ?? null;
  const isEditing = !!search;

  function toggleOutboundField(key: string) {
    setDraft((d) => ({
      ...d,
      outboundFields: d.outboundFields.includes(key)
        ? d.outboundFields.filter((k) => k !== key)
        : [...d.outboundFields, key],
    }));
  }

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
        outboundWebhookUrl: draft.outboundWebhookUrl || null,
        outboundWebhookSecret: draft.outboundWebhookSecret || undefined,
        outboundFields: draft.outboundFields.length > 0 ? draft.outboundFields : null,
      };

      const res = await fetch(isEditing ? `/api/searches/${search!.id}` : "/api/searches", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Errore nel salvataggio");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!search) return;
    setTesting(true);
    setTestMessage("Esecuzione in corso…");
    try {
      const res = await fetch(`/api/searches/${search.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTestMessage(data.error ?? "Errore nel TEST");
        return;
      }
      setTestMessage("TEST accodato — controlla Logs tra qualche secondo per l'esito.");
      onSaved();
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleStatus() {
    if (!search) return;
    const nextStatus = search.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/searches/${search.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Errore");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="mb-1.5 text-xs text-muted-soft">
        {isEditing ? "Modifica ricerca" : "Nuova ricerca"}
      </div>
      <h3 className="mb-6 text-[22px] font-semibold tracking-tight">
        {isEditing ? search!.title : "Nuova ricerca"}
      </h3>

      <Field label="Titolo">
        <input
          type="text"
          placeholder="es. Idraulici Milano mensile"
          className={inputClass}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
      </Field>

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
          Google restituisce al massimo 20 risultati a chiamata: l&apos;area viene coperta con più
          chiamate (a griglia, con suddivisione automatica nelle zone dense) — raggi ampi o
          categorie molto diffuse consumano più quota giornaliera.
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
        <div className="flex gap-2 rounded-full bg-muted p-1.5">
          {(["once", "weekly", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`flex-1 rounded-full px-2.5 py-2 text-[13px] font-medium ${
                draft.frequency === f ? "bg-background shadow-sm" : "text-muted-foreground"
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

      <div className="mb-5 border-t border-border pt-5">
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
      </div>

      <div className="mb-4 border-t border-border pt-5">
        <div className="mb-0.5 text-[13px] font-semibold">Webhook in uscita</div>
        <div className="mb-3.5 text-xs text-muted-soft">
          Vuoto per usare il webhook di default di Impostazioni
        </div>
        <input
          type="text"
          placeholder="https://crm.tuodominio.com/api/webhooks/lead-scraper"
          className={`${inputClass} mb-3 font-mono`}
          value={draft.outboundWebhookUrl}
          onChange={(e) => setDraft((d) => ({ ...d, outboundWebhookUrl: e.target.value }))}
        />
        <input
          type="password"
          placeholder="Shared secret"
          className={`${inputClass} mb-3.5`}
          value={draft.outboundWebhookSecret}
          onChange={(e) => setDraft((d) => ({ ...d, outboundWebhookSecret: e.target.value }))}
        />
        <div className="mb-2 text-xs font-medium text-foreground/80">Campi da inviare nel payload</div>
        {selectedList ? (
          <div className="flex flex-wrap gap-2">
            {FIXED_PLACE_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleOutboundField(f.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  draft.outboundFields.includes(f.key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            {selectedList.attributes.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => toggleOutboundField(a.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  draft.outboundFields.includes(a.key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-soft">
            Seleziona una lista di destinazione per scegliere i campi
          </div>
        )}
      </div>

      {isEditing && search!.runs && search!.runs.length > 0 && (
        <div className="mb-5 border-t border-border pt-5">
          <div className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-soft">
            Storico esecuzioni
          </div>
          {search!.runs.map((r) => (
            <div key={r.id} className="mb-2.5 rounded-md border border-border p-3">
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
      )}

      {testMessage && <div className="mb-3 text-xs text-muted-foreground">{testMessage}</div>}

      <div className="mb-3 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {isEditing ? "Salva modifiche" : "Crea ricerca"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold"
        >
          Annulla
        </button>
      </div>
      {isEditing && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={testing}
            onClick={handleTest}
            className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold disabled:opacity-60"
          >
            {testing ? "In corso…" : "Esegui TEST adesso"}
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={search!.status === "draft" && !search!.listId}
            className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold disabled:opacity-40"
          >
            {search!.status === "active" ? "Pausa" : "Attiva"}
          </button>
        </div>
      )}
    </Drawer>
  );
}
