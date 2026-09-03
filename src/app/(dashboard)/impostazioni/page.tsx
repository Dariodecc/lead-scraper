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
      <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm";

export default function ImpostazioniPage() {
  return (
    <div className="max-w-[640px] px-12 pb-12 pt-10">
      <div className="mb-6">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">
          Impostazioni
        </h1>
        <p className="text-sm text-muted-foreground">
          Chiavi API, webhook di default, stima apertura e documentazione —
          gli Attributi si configurano per singola lista
        </p>
      </div>

      <SettingsCard
        title="Google Places API"
        description="Chiave API e cap di quota giornaliera"
      >
        <Field label="Chiave API">
          <input type="password" placeholder="AIza..." className={inputClass} />
        </Field>
        <Field label="Cap giornaliero richieste">
          <input type="number" defaultValue={500} className={inputClass} />
        </Field>
        <button className="h-10 rounded-md bg-primary px-4.5 text-sm font-semibold text-primary-foreground">
          Salva
        </button>
      </SettingsCard>

      <SettingsCard
        title="Webhook di default"
        description="Usato dalle ricerche che non impostano un webhook proprio"
      >
        <Field label="URL webhook">
          <input
            type="text"
            placeholder="https://crm.tuodominio.com/api/webhooks/lead-scraper"
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Shared secret">
          <input type="password" className={inputClass} />
        </Field>
        <button className="h-10 rounded-md bg-primary px-4.5 text-sm font-semibold text-primary-foreground">
          Salva
        </button>
      </SettingsCard>

      <SettingsCard
        title="Parametri di stima apertura"
        description="Soglie dei bucket, in mesi — stima, non un dato certo"
      >
        <div className="mb-5 grid grid-cols-3 gap-4">
          <Field label="0-4m fino a">
            <input type="number" defaultValue={4} className={inputClass} />
          </Field>
          <Field label="4-8m fino a">
            <input type="number" defaultValue={8} className={inputClass} />
          </Field>
          <Field label="8-12m fino a">
            <input type="number" defaultValue={12} className={inputClass} />
          </Field>
        </div>
        <button className="h-10 rounded-md bg-primary px-4.5 text-sm font-semibold text-primary-foreground">
          Salva
        </button>
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
          Header di autenticazione richiesto sulle chiamate in ingresso al
          webhook
        </div>
        <div className="mb-3.5 rounded-md border border-border bg-background p-3.5 font-mono text-[13px]">
          X-Webhook-Secret: ••••••••
        </div>
        <div className="mb-2 text-xs text-muted-soft">
          Esempio payload in uscita
        </div>
        <div className="whitespace-pre rounded-md border border-border bg-background p-3.5 font-mono text-xs leading-6">
          {`{ "event": "lead.discovered", "place_id": "...",
  "business_name": "...", "attributes": { ... } }`}
        </div>
      </SettingsCard>
    </div>
  );
}
