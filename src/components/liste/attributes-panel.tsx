"use client";

import { useState } from "react";
import { inputClass, selectClass } from "@/components/ui/field";
import { FIXED_PLACE_FIELDS, resolveFixedFieldDisplay } from "@/lib/placeFields";
import {
  DELIVERY_RULE_FIELDS,
  DELIVERY_RULE_OPERATORS,
  type DeliveryRuleCondition,
  type DeliveryRules,
} from "@/lib/deliveryRules";

const ATTR_TYPES = ["text", "number", "date", "boolean", "select"] as const;

export interface ListAttribute {
  id: string;
  name: string;
  key: string;
  type: string;
}

function emptyCondition(): DeliveryRuleCondition {
  return { field: DELIVERY_RULE_FIELDS[0].key, operator: "eq", value: "" };
}

function DeliveryFilterSection({
  listId,
  initialRules,
  initialChainThreshold,
  initialAiEnabled,
  onChanged,
}: {
  listId: string;
  initialRules: DeliveryRules | null;
  initialChainThreshold: number | null;
  initialAiEnabled: boolean;
  onChanged: () => void;
}) {
  const [conditions, setConditions] = useState<DeliveryRuleCondition[]>(
    initialRules?.conditions ?? [],
  );
  const [chainThreshold, setChainThreshold] = useState<string>(
    initialChainThreshold != null ? String(initialChainThreshold) : "",
  );
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [saved, setSaved] = useState(false);

  function updateCondition(i: number, patch: Partial<DeliveryRuleCondition>) {
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function save() {
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryRules: conditions.length > 0 ? { conditions } : null,
        excludeChainsThreshold: chainThreshold.trim() ? Number(chainThreshold) : null,
        aiAnalysisEnabled: aiEnabled,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    onChanged();
  }

  return (
    <div className="mb-5 border-t border-border pt-5">
      <div className="mb-1 text-[13px] font-semibold">Filtro di invio al webhook</div>
      <div className="mb-4 text-xs text-muted-soft">
        Un risultato che non passa resta salvato e visibile (stato &ldquo;Escluso&rdquo;), solo
        non viene inviato. Le condizioni sotto sono tutte richieste insieme (E).
      </div>

      <div className="mb-4 rounded-md border border-border bg-background p-3.5">
        <label className="mb-1.5 block text-[13px] font-medium">Escludi catene</label>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Se lo stesso nome compare già</span>
          <input
            type="number"
            min={2}
            placeholder="es. 2"
            className={`${inputClass} w-20`}
            value={chainThreshold}
            onChange={(e) => setChainThreshold(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">o più volte in questa lista</span>
        </div>
        <div className="text-[11px] text-muted-soft">
          Nessuna lista di brand da mantenere: si basa su ciò che trovi tu stesso — utile per
          scartare catene (McDonald&apos;s, ecc.) senza doverle elencare a mano. Lascia vuoto per
          disattivare.
        </div>
      </div>

      {conditions.map((c, i) => (
        <div key={i} className="mb-2 flex items-center gap-2">
          <select
            className={selectClass}
            style={{ width: 150 }}
            value={c.field}
            onChange={(e) => updateCondition(i, { field: e.target.value })}
          >
            {DELIVERY_RULE_FIELDS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            style={{ width: 190 }}
            value={c.operator}
            onChange={(e) => updateCondition(i, { operator: e.target.value as DeliveryRuleCondition["operator"] })}
          >
            {DELIVERY_RULE_OPERATORS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="valore"
            className={`${inputClass} flex-1`}
            value={c.value}
            onChange={(e) => updateCondition(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="text-xs text-destructive"
            onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
          >
            Rimuovi
          </button>
        </div>
      ))}
      <button
        type="button"
        className="mb-4 text-xs font-semibold underline"
        onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
      >
        + Aggiungi condizione
      </button>

      <label className="mb-4 flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
        Analisi AI del sito (OpenAI) — crea &ldquo;Analisi&rdquo; e &ldquo;Punteggio
        contattabilità&rdquo; per ogni nuovo risultato (richiede la chiave in Impostazioni)
      </label>

      <div>
        <button
          type="button"
          onClick={save}
          className={`h-9 rounded-md px-4 text-[13px] font-semibold ${
            saved ? "bg-success/10 text-success" : "bg-primary text-primary-foreground"
          }`}
        >
          {saved ? "Salvato ✓" : "Salva filtro"}
        </button>
      </div>
    </div>
  );
}

export function AttributesPanel({
  listId,
  attributes,
  visibleFields,
  samplePlace,
  deliveryRules,
  excludeChainsThreshold,
  aiAnalysisEnabled,
  onChanged,
}: {
  listId: string;
  attributes: ListAttribute[];
  visibleFields: string[];
  // Un risultato reale della lista (di solito l'ultimo TEST) usato per mostrare cosa c'è
  // davvero in ogni campo, invece di far scegliere le colonne "al buio" (§7.2).
  samplePlace: Parameters<typeof resolveFixedFieldDisplay>[0] | null;
  deliveryRules: DeliveryRules | null;
  excludeChainsThreshold: number | null;
  aiAnalysisEnabled: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");

  const allFields = [
    ...FIXED_PLACE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    ...attributes.map((a) => ({ key: a.key, label: a.name })),
  ];

  async function addAttribute() {
    if (!name.trim()) return;
    await fetch(`/api/lists/${listId}/attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    setName("");
    setType("text");
    onChanged();
  }

  async function deleteAttribute(attrId: string) {
    await fetch(`/api/lists/${listId}/attributes/${attrId}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleVisible(key: string) {
    const next = visibleFields.includes(key)
      ? visibleFields.filter((k) => k !== key)
      : [...visibleFields, key];
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleFields: next }),
    });
    onChanged();
  }

  const fixedKeys = new Set(FIXED_PLACE_FIELDS.map((f) => f.key as string));

  return (
    <div className="mb-5 rounded-xl border border-border bg-muted p-5">
      <div className="mb-1 text-[13px] font-semibold">Colonne mostrate in tabella</div>
      <div className="mb-3 text-xs text-muted-soft">
        {samplePlace
          ? "Sotto ogni campo il valore reale dell'ultimo risultato — scegli sapendo cosa è davvero popolato per questa categoria."
          : "Esegui un TEST sulla ricerca collegata per vedere un esempio di valori qui sotto."}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {allFields.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggleVisible(f.key)}
            className={`flex max-w-[160px] flex-col items-start rounded-lg border px-3 py-1.5 text-xs font-medium ${
              visibleFields.includes(f.key)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            <span>{f.label}</span>
            {samplePlace && fixedKeys.has(f.key) && (
              <span className="truncate text-[11px] font-normal opacity-80">
                {resolveFixedFieldDisplay(samplePlace, f.key)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-3 text-[13px] font-semibold">Campi personalizzati di questa lista</div>
      <div className="mb-4 flex flex-col gap-2">
        {attributes.length === 0 && (
          <div className="text-xs text-muted-soft">Nessun campo custom ancora</div>
        )}
        {attributes.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3.5 py-2.5"
          >
            <span>
              <span className="text-[13px] font-medium">{a.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-soft">{a.key}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground">{a.type}</span>
              <button className="text-xs text-destructive" onClick={() => deleteAttribute(a.id)}>
                Elimina
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nome campo custom"
          className={`${inputClass} flex-1 bg-background`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          style={{ width: 110 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ATTR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addAttribute}
          className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Aggiungi
        </button>
      </div>

      <DeliveryFilterSection
        listId={listId}
        initialRules={deliveryRules}
        initialChainThreshold={excludeChainsThreshold}
        initialAiEnabled={aiAnalysisEnabled}
        onChanged={onChanged}
      />
    </div>
  );
}
