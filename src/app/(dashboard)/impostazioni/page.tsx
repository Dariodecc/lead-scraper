"use client";

import { useEffect, useState } from "react";

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl bg-secondary p-8">
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="mb-5 text-[13px] text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm";

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-4.5 text-sm font-semibold ${
        saved ? "cursor-default bg-success/10 text-success" : "bg-primary text-primary-foreground"
      }`}
    >
      {saved ? "Salvato ✓" : "Salva"}
    </button>
  );
}

export default function ImpostazioniPage() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [quotaCap, setQuotaCap] = useState(500);
  const [bucketThresholds, setBucketThresholds] = useState({ b1: 4, b2: 8, b3: 12 });
  const [hasOpenAiApiKey, setHasOpenAiApiKey] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [costRates, setCostRates] = useState({
    googleNearbySearchCostPerCall: 0.032,
    googlePlaceDetailsCostPerCall: 0.04,
    openAiInputCostPer1M: 0.15,
    openAiOutputCostPer1M: 0.6,
  });
  const [savedFlags, setSavedFlags] = useState({
    api: false,
    estimation: false,
    openai: false,
    costs: false,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
        setQuotaCap(data.quotaCap);
        setBucketThresholds(data.bucketThresholds);
        setHasOpenAiApiKey(data.hasOpenAiApiKey);
        setCostRates({
          googleNearbySearchCostPerCall: data.googleNearbySearchCostPerCall,
          googlePlaceDetailsCostPerCall: data.googlePlaceDetailsCostPerCall,
          openAiInputCostPer1M: data.openAiInputCostPer1M,
          openAiOutputCostPer1M: data.openAiOutputCostPer1M,
        });
      });
  }, []);

  function flash(key: keyof typeof savedFlags) {
    setSavedFlags((f) => ({ ...f, [key]: true }));
    setTimeout(() => setSavedFlags((f) => ({ ...f, [key]: false })), 1800);
  }

  async function saveApi() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey || undefined, quotaCap }),
    });
    if (apiKey) {
      setHasApiKey(true);
      setApiKey("");
    }
    flash("api");
  }

  async function saveCostRates() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costRates),
    });
    flash("costs");
  }

  async function saveEstimation() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucketThresholds }),
    });
    flash("estimation");
  }

  async function saveOpenAi() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openAiApiKey: openAiApiKey || undefined }),
    });
    if (openAiApiKey) {
      setHasOpenAiApiKey(true);
      setOpenAiApiKey("");
    }
    flash("openai");
  }

  return (
    <div className="max-w-[640px] px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          Chiavi API, costi, stima apertura e documentazione — webhook e Attributi si configurano
          per singola Lista
        </p>
      </div>

      <SettingsCard title="Google Places API" description="Chiave API e cap di quota giornaliera">
        <Field label={hasApiKey ? "Chiave API (impostata — inserisci per sostituirla)" : "Chiave API"}>
          <input
            type="password"
            placeholder="AIza..."
            className={inputClass}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <Field label="Cap giornaliero richieste">
          <input
            type="number"
            className={inputClass}
            value={quotaCap}
            onChange={(e) => setQuotaCap(Number(e.target.value))}
          />
        </Field>
        <SaveButton saved={savedFlags.api} onClick={saveApi} />
      </SettingsCard>

      <SettingsCard
        title="Costi API"
        description="Google non restituisce il costo reale per chiamata — questi tassi sono usati per stimare il costo mostrato per ricerca nei Logs e nel dettaglio Ricerca. Aggiornali se Google/OpenAI cambiano i prezzi."
      >
        <div className="mb-2 grid grid-cols-2 gap-4">
          <Field label="Nearby Search ($/chiamata)">
            <input
              type="number"
              step="0.001"
              className={inputClass}
              value={costRates.googleNearbySearchCostPerCall}
              onChange={(e) =>
                setCostRates((c) => ({ ...c, googleNearbySearchCostPerCall: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label="Place Details ($/chiamata)">
            <input
              type="number"
              step="0.001"
              className={inputClass}
              value={costRates.googlePlaceDetailsCostPerCall}
              onChange={(e) =>
                setCostRates((c) => ({ ...c, googlePlaceDetailsCostPerCall: Number(e.target.value) }))
              }
            />
          </Field>
          <Field label="OpenAI input ($/1M token)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={costRates.openAiInputCostPer1M}
              onChange={(e) => setCostRates((c) => ({ ...c, openAiInputCostPer1M: Number(e.target.value) }))}
            />
          </Field>
          <Field label="OpenAI output ($/1M token)">
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={costRates.openAiOutputCostPer1M}
              onChange={(e) => setCostRates((c) => ({ ...c, openAiOutputCostPer1M: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <SaveButton saved={savedFlags.costs} onClick={saveCostRates} />
      </SettingsCard>

      <SettingsCard
        title="Parametri di stima apertura"
        description="Soglie dei bucket, in mesi — stima, non un dato certo"
      >
        <div className="mb-5 grid grid-cols-3 gap-4">
          <Field label="0-4m fino a">
            <input
              type="number"
              className={inputClass}
              value={bucketThresholds.b1}
              onChange={(e) => setBucketThresholds((t) => ({ ...t, b1: Number(e.target.value) }))}
            />
          </Field>
          <Field label="4-8m fino a">
            <input
              type="number"
              className={inputClass}
              value={bucketThresholds.b2}
              onChange={(e) => setBucketThresholds((t) => ({ ...t, b2: Number(e.target.value) }))}
            />
          </Field>
          <Field label="8-12m fino a">
            <input
              type="number"
              className={inputClass}
              value={bucketThresholds.b3}
              onChange={(e) => setBucketThresholds((t) => ({ ...t, b3: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <SaveButton saved={savedFlags.estimation} onClick={saveEstimation} />
      </SettingsCard>

      <SettingsCard
        title="OpenAI (analisi AI del sito)"
        description="Serve solo se attivi 'Analisi AI' su una Lista (§ Attributi) — genera una breve valutazione e uno scoring di contattabilità per ogni nuovo risultato"
      >
        <Field
          label={hasOpenAiApiKey ? "Chiave API (impostata — inserisci per sostituirla)" : "Chiave API"}
        >
          <input
            type="password"
            placeholder="sk-..."
            className={inputClass}
            value={openAiApiKey}
            onChange={(e) => setOpenAiApiKey(e.target.value)}
          />
        </Field>
        <SaveButton saved={savedFlags.openai} onClick={saveOpenAi} />
      </SettingsCard>

      <SettingsCard title="Documentazione API" description="Sola consultazione">
        <div className="mb-3.5 rounded-md border border-border bg-background p-4 font-mono text-[12.5px] leading-7">
          GET /api/places
          <br />
          GET /api/lists · GET /api/lists/:id/places
          <br />
          POST /api/searches · PATCH /api/searches/:id
          <br />
          POST /api/searches/:id/test
          <br />
          POST /api/places/:id/redeliver
          <br />
          GET /api/logs
          <br />
          GET /api/lists/:id/attributes
        </div>
        <div className="mb-2 text-xs text-muted-soft">
          Header di autenticazione richiesto sulle chiamate in ingresso al webhook
        </div>
        <div className="mb-3.5 rounded-md border border-border bg-background p-3.5 font-mono text-[13px]">
          X-Webhook-Secret: ••••••••
        </div>
        <div className="mb-2 text-xs text-muted-soft">Esempio payload in uscita</div>
        <div className="whitespace-pre rounded-md border border-border bg-background p-3.5 font-mono text-xs leading-6">
          {`{ "event": "lead.discovered", "place_id": "...",
  "business_name": "...", "attributes": { ... } }`}
        </div>
      </SettingsCard>
    </div>
  );
}
