"use client";

import { useEffect, useState } from "react";
import { Copy } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "google", label: "Google Places" },
  { id: "costi", label: "Costi API" },
  { id: "stima", label: "Stima apertura" },
  { id: "openai", label: "OpenAI" },
  { id: "api", label: "Documentazione API" },
] as const;

const ENDPOINTS: { method: "GET" | "POST" | "PATCH"; path: string }[] = [
  { method: "GET", path: "/api/places" },
  { method: "GET", path: "/api/lists" },
  { method: "GET", path: "/api/lists/:id/places" },
  { method: "GET", path: "/api/lists/:id/attributes" },
  { method: "POST", path: "/api/searches" },
  { method: "PATCH", path: "/api/searches/:id" },
  { method: "POST", path: "/api/searches/:id/test" },
  { method: "POST", path: "/api/places/:id/redeliver" },
  { method: "GET", path: "/api/logs" },
];

const METHOD_STYLE = {
  GET: "bg-success/12 text-success-fg",
  POST: "bg-brand-soft text-brand",
  PATCH: "bg-warning/18 text-warning-fg",
} as const;

const PAYLOAD_EXAMPLE = `{ "event": "lead.discovered", "place_id": "...",
  "business_name": "...", "attributes": { ... } }`;

function SettingsPanel({
  id,
  title,
  description,
  footer,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel id={id} className="scroll-mt-6">
      <PanelHeader title={title} description={description} />
      <PanelBody>{children}</PanelBody>
      {footer && <div className="flex justify-end rounded-b-lg border-t border-border bg-muted/40 px-5 py-3">{footer}</div>}
    </Panel>
  );
}

export default function ImpostazioniPage() {
  const toast = useToast();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [quotaCap, setQuotaCap] = useState(500);
  const [bucketThresholds, setBucketThresholds] = useState({ b1: 4, b2: 8, b3: 12 });
  const [hasOpenAiApiKey, setHasOpenAiApiKey] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [costRates, setCostRates] = useState({
    openAiInputCostPer1M: 0.15,
    openAiOutputCostPer1M: 0.6,
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
        setQuotaCap(data.quotaCap);
        setBucketThresholds(data.bucketThresholds);
        setHasOpenAiApiKey(data.hasOpenAiApiKey);
        setCostRates({
          openAiInputCostPer1M: data.openAiInputCostPer1M,
          openAiOutputCostPer1M: data.openAiOutputCostPer1M,
        });
      });
  }, []);

  async function patch(key: string, body: object, after?: () => void) {
    setSaving(key);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Salvataggio non riuscito", description: data.error, tone: "danger" });
        return;
      }
      after?.();
      toast({ title: "Impostazioni salvate", tone: "success" });
    } finally {
      setSaving(null);
    }
  }

  const saveApi = () =>
    patch("api", { apiKey: apiKey || undefined, quotaCap }, () => {
      if (apiKey) {
        setHasApiKey(true);
        setApiKey("");
      }
    });
  const saveCostRates = () => patch("costs", costRates);
  const saveEstimation = () => patch("estimation", { bucketThresholds });
  const saveOpenAi = () =>
    patch("openai", { openAiApiKey: openAiApiKey || undefined }, () => {
      if (openAiApiKey) {
        setHasOpenAiApiKey(true);
        setOpenAiApiKey("");
      }
    });

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(PAYLOAD_EXAMPLE);
      toast({ title: "Payload copiato", tone: "success" });
    } catch {
      toast({ title: "Copia non riuscita", tone: "danger" });
    }
  }

  const save = (key: string, onClick: () => void) => (
    <Button loading={saving === key} onClick={onClick}>
      Salva
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Impostazioni"
        description="Chiavi API, costi, stima di apertura e documentazione. Webhook e campi si configurano per singola lista."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Sezioni" className="rise sticky top-10 hidden lg:block" style={{ "--i": 1 } as React.CSSProperties}>
          <ul className="grid gap-0.5 border-l border-border">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="-ml-px block border-l border-transparent py-1.5 pl-3.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rise grid max-w-2xl gap-6" style={{ "--i": 2 } as React.CSSProperties}>
          <SettingsPanel
            id="google"
            title="Google Places API"
            description="Chiave API e tetto di richieste giornaliere."
            footer={save("api", saveApi)}
          >
            <div className="grid gap-5">
              <Field
                label={
                  <span className="inline-flex items-center gap-2">
                    Chiave API {hasApiKey && <Badge tone="success">Impostata</Badge>}
                  </span>
                }
                hint={hasApiKey ? "Inserisci un nuovo valore solo per sostituirla." : undefined}
              >
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={hasApiKey ? "••••••••••••••••" : "AIza..."}
                  className="font-mono"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </Field>
              <Field label="Cap giornaliero richieste" hint="Oltre questa soglia le ricerche si fermano fino al giorno dopo.">
                <Input
                  type="number"
                  className="num max-w-40"
                  value={quotaCap}
                  onChange={(e) => setQuotaCap(Number(e.target.value))}
                />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="costi"
            title="Costi API"
            description="Google Places: costo reale calcolato dal worker sul tariffario ufficiale a scaglioni e sul volume del mese in corso (non un tasso fisso). OpenAI: calcolato dai token realmente usati, moltiplicati per i tassi qui sotto: aggiornali se i prezzi di gpt-4o-mini cambiano."
            footer={save("costs", saveCostRates)}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="OpenAI input ($/1M token)">
                <Input
                  type="number"
                  step="0.01"
                  className="num"
                  value={costRates.openAiInputCostPer1M}
                  onChange={(e) => setCostRates((c) => ({ ...c, openAiInputCostPer1M: Number(e.target.value) }))}
                />
              </Field>
              <Field label="OpenAI output ($/1M token)">
                <Input
                  type="number"
                  step="0.01"
                  className="num"
                  value={costRates.openAiOutputCostPer1M}
                  onChange={(e) => setCostRates((c) => ({ ...c, openAiOutputCostPer1M: Number(e.target.value) }))}
                />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="stima"
            title="Parametri di stima apertura"
            description="Soglie dei bucket, in mesi. È una stima, non un dato certo."
            footer={save("estimation", saveEstimation)}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="0–4 mesi, fino a">
                <Input
                  type="number"
                  className="num"
                  value={bucketThresholds.b1}
                  onChange={(e) => setBucketThresholds((t) => ({ ...t, b1: Number(e.target.value) }))}
                />
              </Field>
              <Field label="4–8 mesi, fino a">
                <Input
                  type="number"
                  className="num"
                  value={bucketThresholds.b2}
                  onChange={(e) => setBucketThresholds((t) => ({ ...t, b2: Number(e.target.value) }))}
                />
              </Field>
              <Field label="8–12 mesi, fino a">
                <Input
                  type="number"
                  className="num"
                  value={bucketThresholds.b3}
                  onChange={(e) => setBucketThresholds((t) => ({ ...t, b3: Number(e.target.value) }))}
                />
              </Field>
            </div>
          </SettingsPanel>

          <SettingsPanel
            id="openai"
            title="OpenAI (analisi AI del sito)"
            description="Serve solo se attivi l'Analisi AI su una lista: genera una breve valutazione e un punteggio di contattabilità per ogni nuovo risultato."
            footer={save("openai", saveOpenAi)}
          >
            <Field
              label={
                <span className="inline-flex items-center gap-2">
                  Chiave API {hasOpenAiApiKey && <Badge tone="success">Impostata</Badge>}
                </span>
              }
              hint={hasOpenAiApiKey ? "Inserisci un nuovo valore solo per sostituirla." : undefined}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder={hasOpenAiApiKey ? "••••••••••••••••" : "sk-..."}
                className="font-mono"
                value={openAiApiKey}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
              />
            </Field>
          </SettingsPanel>

          <SettingsPanel id="api" title="Documentazione API" description="Sola consultazione.">
            <h3 className="text-[13px] font-medium">Endpoint</h3>
            <ul className="mt-2 overflow-hidden rounded-md border border-border">
              {ENDPOINTS.map((e) => (
                <li key={`${e.method}${e.path}`} className="flex items-center gap-3 border-b border-hairline-soft px-3 py-2 last:border-0">
                  <span className={cn("w-14 shrink-0 rounded-sm px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold", METHOD_STYLE[e.method])}>
                    {e.method}
                  </span>
                  <code className="truncate font-mono text-[13px]">{e.path}</code>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-[13px] font-medium">Autenticazione del webhook</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Header richiesto sulle chiamate in ingresso.</p>
            <code className="mt-2 block rounded-md border border-border bg-muted/60 px-3.5 py-2.5 font-mono text-[13px]">
              X-Webhook-Secret: ••••••••
            </code>

            <div className="mt-6 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-medium">Esempio di payload in uscita</h3>
              <Button variant="ghost" size="xs" onClick={copyPayload}>
                <Copy aria-hidden />
                Copia
              </Button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/60 px-3.5 py-3 font-mono text-xs leading-6 scroll-thin">
              {PAYLOAD_EXAMPLE}
            </pre>
          </SettingsPanel>
        </div>
      </div>
    </>
  );
}
