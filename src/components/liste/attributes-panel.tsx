"use client";

import { useState } from "react";
import { inputClass, selectClass } from "@/components/ui/field";
import { FIXED_PLACE_FIELDS } from "@/lib/placeFields";
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

const AI_PROMPT_PLACEHOLDER = `Sei un analista che valuta se contattare questa attività come potenziale cliente per servizi di siti web/marketing.

Valuta in particolare: [scrivi qui i tuoi criteri specifici, es. settore, zona, dimensione].

Rispondi SOLO con un oggetto JSON valido con questi campi:
- "punteggio": intero 0-100
- "fascia": uno tra "alto", "medio", "basso", "escluso"
- "escludi_da_pipeline": true/false
- "motivo_esclusione": stringa o null (solo se escluso)
- "motivo_pipeline": stringa o null (solo se NON escluso, perché merita di entrare in pipeline)
- "descrizione": 2-4 frasi in italiano`;

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-background p-4">
      <div className="mb-1 text-[13px] font-semibold">{title}</div>
      {description && <div className="mb-3 text-xs text-muted-soft">{description}</div>}
      {children}
    </div>
  );
}

function DeliveryFilterSection({
  listId,
  initialRules,
  initialChainThreshold,
  initialAiEnabled,
  initialAiPromptMd,
  initialWebhookUrl,
  initialHasWebhookSecret,
  initialOutboundFields,
  attributes,
  onChanged,
}: {
  listId: string;
  initialRules: DeliveryRules | null;
  initialChainThreshold: number | null;
  initialAiEnabled: boolean;
  initialAiPromptMd: string | null;
  initialWebhookUrl: string | null;
  initialHasWebhookSecret: boolean;
  initialOutboundFields: string[] | null;
  attributes: ListAttribute[];
  onChanged: () => void;
}) {
  const [conditions, setConditions] = useState<DeliveryRuleCondition[]>(
    initialRules?.conditions ?? [],
  );
  const [chainThreshold, setChainThreshold] = useState<string>(
    initialChainThreshold != null ? String(initialChainThreshold) : "",
  );
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [aiPromptMd, setAiPromptMd] = useState(initialAiPromptMd ?? "");
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [outboundFields, setOutboundFields] = useState<string[]>(initialOutboundFields ?? []);
  const [saved, setSaved] = useState(false);

  function updateCondition(i: number, patch: Partial<DeliveryRuleCondition>) {
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function toggleOutboundField(key: string) {
    setOutboundFields((fs) => (fs.includes(key) ? fs.filter((k) => k !== key) : [...fs, key]));
  }

  async function save() {
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryRules: conditions.length > 0 ? { conditions } : null,
        excludeChainsThreshold: chainThreshold.trim() ? Number(chainThreshold) : null,
        aiAnalysisEnabled: aiEnabled,
        aiPromptMd: aiEnabled ? aiPromptMd : null,
        outboundWebhookUrl: webhookUrl,
        outboundWebhookSecret: webhookSecret || undefined,
        outboundFields: outboundFields.length > 0 ? outboundFields : null,
      }),
    });
    setWebhookSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    onChanged();
  }

  return (
    <div>
      <SectionCard
        title="Analisi AI del lead (OpenAI)"
        description="Per ogni nuovo risultato crea 6 campi: Analisi, Punteggio (0-100), Fascia, Escludi da pipeline, Motivo esclusione, Motivo pipeline (richiede la chiave API in Impostazioni). Se l'AI segnala l'esclusione (catena, multinazionale, sito già ottimo, attività chiusa), il risultato non viene inviato al webhook — stesso meccanismo delle catene rilevate a testo sotto. Se l'analisi fallisce del tutto (es. errore OpenAI), il risultato NON viene inviato finché non la rilanci da Logs."
      >
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
          Attiva analisi AI per questa lista
        </label>
        {aiEnabled && (
          <div className="rounded-md border border-border bg-muted p-3.5">
            <label className="mb-1.5 block text-[13px] font-medium">
              Prompt di analisi personalizzato (Markdown) — opzionale
            </label>
            <div className="mb-2 text-[11px] text-muted-soft">
              Se compilato, <strong>sostituisce integralmente</strong> le istruzioni di default —
              devi includere tu la richiesta di rispondere in JSON con almeno i campi{" "}
              <code>punteggio</code> (0-100), <code>fascia</code>{" "}
              (alto/medio/basso/escluso), <code>escludi_da_pipeline</code> (booleano) e{" "}
              <code>descrizione</code>: se ne ometti anche solo uno l&apos;analisi fallirà, con
              l&apos;errore visibile nei Logs. I dati dell&apos;attività (nome, sito, rating, segnali
              tecnici reali del sito, testo estratto dalla pagina) vengono allegati automaticamente
              sotto al tuo prompt. Lascia vuoto per usare le istruzioni di default.
            </div>
            <textarea
              rows={10}
              placeholder={AI_PROMPT_PLACEHOLDER}
              className={`${inputClass} font-mono text-xs`}
              value={aiPromptMd}
              onChange={(e) => setAiPromptMd(e.target.value)}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Esclusione automatica catene"
        description="Nessuna lista di brand da mantenere a mano — si basa su ciò che la lista osserva da sola."
      >
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
          Esempio con soglia 2: la ricerca trova un &ldquo;McDonald&apos;s&rdquo; → va bene, è il
          primo con quel nome, resta Nuovo. Più avanti (stessa lista, anche da un&apos;altra
          ricerca) ne trova un secondo → quello viene segnato Escluso, perché il sistema deduce
          da solo &ldquo;stesso nome due volte = probabile catena con più sedi&rdquo;. Vale solo da
          quando attivi la soglia in poi — chi era già stato trovato prima non viene ricontrollato.
          Lascia vuoto per disattivare.
        </div>
      </SectionCard>

      <SectionCard
        title="Filtro di invio (regole manuali)"
        description="Condizioni deterministiche e gratuite (nessuna chiamata AI), utili anche senza Analisi AI attiva — es. 'invia solo se rating ≥ 4' o 'escludi categoria X'. Un risultato che non passa resta salvato e visibile (stato 'Escluso'), solo non viene inviato. Tutte le condizioni sotto sono richieste insieme (E). Si applicano DOPO l'eventuale esclusione AI/catene."
      >
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
          className="text-xs font-semibold underline"
          onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
        >
          + Aggiungi condizione
        </button>
      </SectionCard>

      <SectionCard
        title="Webhook di questa lista"
        description="Configurabile SOLO qui, per lista — nessun default globale né override per ricerca."
      >
        <input
          type="text"
          placeholder="https://crm.tuodominio.com/api/webhooks/lead-scraper"
          className={`${inputClass} mb-3 font-mono`}
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <input
          type="password"
          placeholder={initialHasWebhookSecret ? "Secret già impostato — lascia vuoto per non cambiarlo" : "Shared secret"}
          className={`${inputClass} mb-3.5`}
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
        />
        <div className="mb-2 text-xs font-medium text-foreground/80">Campi da inviare nel payload</div>
        <div className="flex flex-wrap gap-2">
          {FIXED_PLACE_FIELDS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleOutboundField(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                outboundFields.includes(f.key)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          {attributes.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => toggleOutboundField(a.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                outboundFields.includes(a.key)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </SectionCard>

      <button
        type="button"
        onClick={save}
        className={`h-9 rounded-md px-4 text-[13px] font-semibold ${
          saved ? "bg-success/10 text-success" : "bg-primary text-primary-foreground"
        }`}
      >
        {saved ? "Salvato ✓" : "Salva"}
      </button>
    </div>
  );
}

export function AttributesPanel({
  listId,
  attributes,
  visibleFields,
  deliveryRules,
  excludeChainsThreshold,
  aiAnalysisEnabled,
  aiPromptMd,
  outboundWebhookUrl,
  hasOutboundWebhookSecret,
  outboundFields,
  onChanged,
}: {
  listId: string;
  attributes: ListAttribute[];
  visibleFields: string[];
  deliveryRules: DeliveryRules | null;
  excludeChainsThreshold: number | null;
  aiAnalysisEnabled: boolean;
  aiPromptMd: string | null;
  outboundWebhookUrl: string | null;
  hasOutboundWebhookSecret: boolean;
  outboundFields: string[] | null;
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

  return (
    <div className="mb-5 rounded-xl border border-border bg-muted p-5">
      <SectionCard
        title="Colonne mostrate in tabella"
        description="Scegli quali campi (fissi o personalizzati) compaiono come colonne nella tabella della lista."
      >
        <div className="flex flex-wrap gap-2">
          {allFields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleVisible(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                visibleFields.includes(f.key)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Campi personalizzati di questa lista">
        <div className="mb-3 flex flex-col gap-2">
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
      </SectionCard>

      <DeliveryFilterSection
        listId={listId}
        initialRules={deliveryRules}
        initialChainThreshold={excludeChainsThreshold}
        initialAiEnabled={aiAnalysisEnabled}
        initialAiPromptMd={aiPromptMd}
        initialWebhookUrl={outboundWebhookUrl}
        initialHasWebhookSecret={hasOutboundWebhookSecret}
        initialOutboundFields={outboundFields}
        attributes={attributes}
        onChanged={onChanged}
      />
    </div>
  );
}
