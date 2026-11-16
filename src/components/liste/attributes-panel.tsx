"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash, X } from "@phosphor-icons/react";
import { Field, Input, Select, Textarea, inputClass, selectClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { FIXED_PLACE_FIELDS } from "@/lib/placeFields";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
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
- "escludi_da_pipeline": true/false
- "motivo_esclusione": stringa o null (solo se escluso)
- "motivo_pipeline": stringa o null (solo se NON escluso, perché merita di entrare in pipeline)
- "descrizione": 2-4 frasi in italiano`;

// Bound reale di worker/src/screenshot.ts (screenshot ridimensionato a 1024x2000 prima di
// inviarlo) — dopo il ridimensionamento interno di OpenAI (lato corto a 768px) l'immagine finale
// è al più ~768x1500px, cioè 6 tile. Formula ufficiale gpt-4o-mini: 2833 token base + 5667 per
// tile (developers.openai.com/api/docs/guides/images-vision) — non una stima a caso.
const VISION_MAX_TOKENS = 2833 + 6 * 5667;

type TabKey = "colonne" | "campi" | "ai" | "filtri" | "webhook";

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border py-6 first:pt-0 last:border-0 last:pb-0">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Pulsante a chip on/off per scegliere campi (colonne, payload webhook). */
function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-brand/40 bg-brand-soft text-brand"
          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {active && <Check size={13} weight="bold" aria-hidden />}
      {children}
    </button>
  );
}

function DeliveryFilterSection({
  tab,
  listId,
  initialRules,
  initialChainThreshold,
  initialAiEnabled,
  initialAiPromptMd,
  initialAiVisionEnabled,
  initialWebhookUrl,
  initialHasWebhookSecret,
  initialOutboundFields,
  attributes,
  onChanged,
}: {
  tab: TabKey;
  listId: string;
  initialRules: DeliveryRules | null;
  initialChainThreshold: number | null;
  initialAiEnabled: boolean;
  initialAiPromptMd: string | null;
  initialAiVisionEnabled: boolean;
  initialWebhookUrl: string | null;
  initialHasWebhookSecret: boolean;
  initialOutboundFields: string[] | null;
  attributes: ListAttribute[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [conditions, setConditions] = useState<DeliveryRuleCondition[]>(initialRules?.conditions ?? []);
  const [chainThreshold, setChainThreshold] = useState<string>(
    initialChainThreshold != null ? String(initialChainThreshold) : "",
  );
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled);
  const [aiPromptMd, setAiPromptMd] = useState(initialAiPromptMd ?? "");
  const [aiVisionEnabled, setAiVisionEnabled] = useState(initialAiVisionEnabled);
  const [openAiInputCostPer1M, setOpenAiInputCostPer1M] = useState(0.15);
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [outboundFields, setOutboundFields] = useState<string[]>(initialOutboundFields ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.openAiInputCostPer1M === "number") setOpenAiInputCostPer1M(d.openAiInputCostPer1M);
      })
      .catch(() => {});
  }, []);

  function updateCondition(i: number, patch: Partial<DeliveryRuleCondition>) {
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function toggleOutboundField(key: string) {
    setOutboundFields((fs) => (fs.includes(key) ? fs.filter((k) => k !== key) : [...fs, key]));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryRules: conditions.length > 0 ? { conditions } : null,
          excludeChainsThreshold: chainThreshold.trim() ? Number(chainThreshold) : null,
          aiAnalysisEnabled: aiEnabled,
          aiPromptMd: aiEnabled ? aiPromptMd : null,
          aiVisionEnabled: aiEnabled && aiVisionEnabled,
          outboundWebhookUrl: webhookUrl,
          outboundWebhookSecret: webhookSecret || undefined,
          outboundFields: outboundFields.length > 0 ? outboundFields : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Salvataggio non riuscito", description: data.error, tone: "danger" });
        return;
      }
      setWebhookSecret("");
      toast({ title: "Impostazioni salvate", tone: "success" });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const showSave = tab === "ai" || tab === "filtri" || tab === "webhook";

  return (
    <>
      <div hidden={tab !== "ai"}>
        <Block
          title="Analisi AI del lead"
          description="Per ogni nuovo risultato l'AI scrive una valutazione e un punteggio di contattabilità, e può escluderlo dall'invio (catena, multinazionale, sito già ottimo, attività chiusa)."
        >
          <div className="grid gap-5">
            <Switch
              checked={aiEnabled}
              onChange={setAiEnabled}
              label="Attiva l'analisi AI per questa lista"
              description="Richiede la chiave API OpenAI in Impostazioni."
            />

            <details className="group rounded-md border border-border bg-muted/50 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <summary className="cursor-pointer text-[13px] font-medium text-foreground marker:text-muted-soft">
                Come funziona
              </summary>
              <p className="mt-2">
                Crea 6 campi: Analisi, Punteggio contattabilità (0-100, ordinabile in tabella — la priorità di contatto
                è il punteggio stesso), Escludi da pipeline, Motivo esclusione, Motivo pipeline, Sito online dal. Se
                l&apos;AI segnala l&apos;esclusione, il risultato non viene inviato al webhook — stesso meccanismo delle
                catene rilevate a testo (scheda Filtri). Se l&apos;analisi fallisce del tutto (es. errore OpenAI), il
                risultato NON viene inviato finché non la rilanci da Logs.
              </p>
            </details>

            {aiEnabled && (
              <>
                <Field
                  label="Prompt di analisi personalizzato (Markdown)"
                  optional
                  hint={
                    <>
                      Se compilato, <strong className="font-semibold text-foreground">sostituisce integralmente</strong>{" "}
                      le istruzioni di default: devi includere tu la richiesta di rispondere in JSON con almeno{" "}
                      <code className="font-mono">punteggio</code> (0-100), <code className="font-mono">escludi_da_pipeline</code>{" "}
                      (booleano) e <code className="font-mono">descrizione</code>. Se ne ometti uno l&apos;analisi fallirà
                      (errore visibile nei Logs). I dati dell&apos;attività vengono allegati in automatico sotto al tuo
                      prompt. Lascia vuoto per le istruzioni di default.
                    </>
                  }
                >
                  <Textarea
                    rows={10}
                    placeholder={AI_PROMPT_PLACEHOLDER}
                    className="font-mono text-xs"
                    value={aiPromptMd}
                    onChange={(e) => setAiPromptMd(e.target.value)}
                  />
                </Field>

                <Switch
                  checked={aiVisionEnabled}
                  onChange={setAiVisionEnabled}
                  label="Analizza anche uno screenshot del sito (visione gpt-4o-mini)"
                  description={
                    <>
                      L&apos;AI vede davvero il design invece di dedurlo dal solo testo estratto. Spento di default:{" "}
                      <strong className="font-semibold text-foreground">
                        costo aggiuntivo reale fino a {formatUsd((VISION_MAX_TOKENS / 1_000_000) * openAiInputCostPer1M, 4)}{" "}
                        per lead con sito
                      </strong>{" "}
                      (screenshot dell&apos;intera pagina in un&apos;unica immagine, ridimensionata prima dell&apos;invio).
                      Le immagini costano molto più del solo testo: {VISION_MAX_TOKENS.toLocaleString("it-IT")} token
                      contro le poche centinaia di un&apos;analisi testuale. Calcolato dal tasso OpenAI impostato in
                      Impostazioni.
                    </>
                  }
                />
              </>
            )}
          </div>
        </Block>
      </div>

      <div hidden={tab !== "filtri"}>
        <Block
          title="Esclusione automatica catene"
          description="Nessuna lista di brand da mantenere a mano: si basa su ciò che la lista osserva da sola."
        >
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <label htmlFor="chain-threshold">Se lo stesso nome compare già</label>
            <input
              id="chain-threshold"
              type="number"
              min={2}
              placeholder="es. 2"
              className={cn(inputClass, "num w-20")}
              value={chainThreshold}
              onChange={(e) => setChainThreshold(e.target.value)}
            />
            <span>o più volte in questa lista</span>
          </div>
          <details className="mt-3 rounded-md border border-border bg-muted/50 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <summary className="cursor-pointer text-[13px] font-medium text-foreground marker:text-muted-soft">
              Esempio
            </summary>
            <p className="mt-2">
              Con soglia 2: la ricerca trova un &ldquo;McDonald&apos;s&rdquo; → va bene, è il primo con quel nome, resta
              Nuovo. Più avanti (stessa lista, anche da un&apos;altra ricerca) ne trova un secondo → viene segnato
              Escluso, perché il sistema deduce da solo &ldquo;stesso nome due volte = probabile catena con più
              sedi&rdquo;. Vale solo da quando attivi la soglia: chi era già stato trovato prima non viene
              ricontrollato. Lascia vuoto per disattivare.
            </p>
          </details>
        </Block>

        <Block
          title="Filtro di invio (regole manuali)"
          description="Condizioni deterministiche e gratuite (nessuna chiamata AI), utili anche senza Analisi AI: es. «invia solo se rating ≥ 4». Un risultato che non passa resta salvato e visibile (stato Escluso), ma non viene inviato. Tutte le condizioni sono richieste insieme (E) e si applicano dopo l'eventuale esclusione AI/catene."
        >
          <div className="grid gap-2">
            {conditions.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[150px_190px_minmax(0,1fr)_auto]">
                <select
                  aria-label="Campo"
                  className={selectClass}
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
                  aria-label="Operatore"
                  className={selectClass}
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
                  aria-label="Valore"
                  placeholder="valore"
                  className={inputClass}
                  value={c.value}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Rimuovi la condizione"
                  onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                  className="hover:text-destructive-fg"
                >
                  <X weight="bold" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={conditions.length > 0 ? "mt-3" : undefined}
            onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
          >
            <Plus weight="bold" aria-hidden />
            Aggiungi condizione
          </Button>
        </Block>
      </div>

      <div hidden={tab !== "webhook"}>
        <Block
          title="Webhook di questa lista"
          description="Si configura solo qui, per lista: nessun default globale né override per ricerca."
        >
          <div className="grid gap-4">
            <Field label="URL del webhook">
              <Input
                type="text"
                placeholder="https://crm.tuodominio.com/api/webhooks/lead-scraper"
                className="font-mono text-[13px]"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </Field>
            <Field
              label="Shared secret"
              hint={initialHasWebhookSecret ? "Già impostato: lascia vuoto per non cambiarlo." : undefined}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder={initialHasWebhookSecret ? "••••••••" : "Shared secret"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </Field>
            <div>
              <div className="text-[13px] font-medium">Campi da inviare nel payload</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {outboundFields.length === 0 ? "Nessuno selezionato: viene inviato il payload completo." : `${outboundFields.length} selezionati.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FIXED_PLACE_FIELDS.map((f) => (
                  <ChipToggle key={f.key} active={outboundFields.includes(f.key)} onClick={() => toggleOutboundField(f.key)}>
                    {f.label}
                  </ChipToggle>
                ))}
                {attributes.map((a) => (
                  <ChipToggle key={a.key} active={outboundFields.includes(a.key)} onClick={() => toggleOutboundField(a.key)}>
                    {a.name}
                  </ChipToggle>
                ))}
              </div>
            </div>
          </div>
        </Block>
      </div>

      {showSave && (
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-auto flex items-center justify-between gap-3 border-t border-border bg-background/90 px-6 py-3.5 backdrop-blur">
          <p className="text-xs text-muted-foreground">Le modifiche di queste schede si applicano con «Salva».</p>
          <Button loading={saving} onClick={save}>
            Salva
          </Button>
        </div>
      )}
    </>
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
  aiVisionEnabled,
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
  aiVisionEnabled: boolean;
  outboundWebhookUrl: string | null;
  hasOutboundWebhookSecret: boolean;
  outboundFields: string[] | null;
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<TabKey>("colonne");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");

  const allFields = [
    ...FIXED_PLACE_FIELDS.map((f) => ({ key: f.key as string, label: f.label as string })),
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

  async function deleteAttribute(a: ListAttribute) {
    const ok = await confirm({
      title: `Eliminare il campo "${a.name}"?`,
      description: "I valori già salvati in questo campo andranno persi.",
      confirmLabel: "Elimina campo",
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`/api/lists/${listId}/attributes/${a.id}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleVisible(key: string) {
    const next = visibleFields.includes(key) ? visibleFields.filter((k) => k !== key) : [...visibleFields, key];
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleFields: next }),
    });
    onChanged();
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background px-6 pt-2">
        <Tabs<TabKey>
          label="Sezioni di configurazione"
          value={tab}
          onChange={setTab}
          items={[
            { value: "colonne", label: "Colonne", hint: "auto" },
            { value: "campi", label: "Campi", hint: "auto" },
            { value: "ai", label: "Analisi AI" },
            { value: "filtri", label: "Filtri" },
            { value: "webhook", label: "Webhook" },
          ]}
        />
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
        <div hidden={tab !== "colonne"}>
          <Block
            title="Colonne mostrate in tabella"
            description="Scegli quali campi (fissi o personalizzati) compaiono come colonne nella tabella della lista. Si applica subito."
          >
            <div className="flex flex-wrap gap-2">
              {allFields.map((f) => (
                <ChipToggle key={f.key} active={visibleFields.includes(f.key)} onClick={() => toggleVisible(f.key)}>
                  {f.label}
                </ChipToggle>
              ))}
            </div>
          </Block>
        </div>

        <div hidden={tab !== "campi"}>
          <Block
            title="Campi personalizzati"
            description="Campi extra di questa lista, compilabili a mano o dall'analisi AI. Si applica subito."
          >
            {attributes.length === 0 ? (
              <p className="mb-4 text-[13px] text-muted-soft">Nessun campo personalizzato ancora.</p>
            ) : (
              <ul className="mb-4 grid gap-1.5">
                {attributes.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-border bg-card py-1.5 pl-3.5 pr-1.5"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-[13px] font-medium">{a.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-soft">{a.key}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{a.type}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Elimina il campo ${a.name}`}
                        onClick={() => deleteAttribute(a)}
                        className="hover:text-destructive-fg"
                      >
                        <Trash />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Nome del nuovo campo"
                placeholder="Nome campo"
                className={cn(inputClass, "flex-1")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAttribute()}
              />
              <Select aria-label="Tipo del campo" className="w-28" value={type} onChange={(e) => setType(e.target.value)}>
                {ATTR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={addAttribute} disabled={!name.trim()}>
                <Plus weight="bold" aria-hidden />
                Aggiungi
              </Button>
            </div>
          </Block>
        </div>

        <DeliveryFilterSection
          tab={tab}
          listId={listId}
          initialRules={deliveryRules}
          initialChainThreshold={excludeChainsThreshold}
          initialAiEnabled={aiAnalysisEnabled}
          initialAiPromptMd={aiPromptMd}
          initialAiVisionEnabled={aiVisionEnabled}
          initialWebhookUrl={outboundWebhookUrl}
          initialHasWebhookSecret={hasOutboundWebhookSecret}
          initialOutboundFields={outboundFields}
          attributes={attributes}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
