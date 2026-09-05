"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardData {
  leads: { total: number; pending: number; delivered: number; failed: number; excluded: number; newToday: number };
  costs: {
    monthToDate: { googleUsd: number; aiUsd: number; totalUsd: number };
    today: { googleUsd: number; aiUsd: number; totalUsd: number };
  };
  googleQuota: { usedToday: number; cap: number; percent: number };
  searches: {
    active: number;
    paused: number;
    draft: number;
    nextScheduled: { id: string; title: string; nextRunAt: string } | null;
  };
  lists: { count: number; topByVolume: { id: string; name: string; total: number }[] };
  recentErrors: { id: string; category: string; message: string; createdAt: string; searchTitle: string | null }[];
  pendingRetries: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  search_run: "Esecuzione ricerca",
  google_api: "Google API",
  ai_analysis: "Analisi AI",
  webhook_delivery: "Consegna webhook",
  system: "Sistema",
};

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-5">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-[26px] font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-soft">{sub}</div>}
    </div>
  );
}

function formatUsd(v: number) {
  return `$${v.toFixed(v < 1 ? 4 : 2)}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  if (!data) return <div className="px-12 pb-12 pt-10 text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <div className="px-12 pb-12 pt-10">
      <div className="mb-8">
        <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Panoramica di lead, costi e stato del sistema</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatTile label="Lead totali" value={String(data.leads.total)} sub={`+${data.leads.newToday} oggi`} />
        <StatTile
          label="Consegnati"
          value={String(data.leads.delivered)}
          sub={`${data.leads.pending} in attesa`}
          tone="text-success"
        />
        <StatTile
          label="Da riprovare"
          value={String(data.pendingRetries)}
          sub="consegna o analisi AI fallita"
          tone={data.pendingRetries > 0 ? "text-destructive" : undefined}
        />
        <StatTile label="Esclusi" value={String(data.leads.excluded)} sub="catene / regole di lista" />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-3.5 text-[13px] font-semibold">Costi API — mese corrente</div>
          <div className="mb-3 text-[26px] font-semibold tracking-tight">
            {formatUsd(data.costs.monthToDate.totalUsd)}
          </div>
          <div className="flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Google Places API</span>
              <span>{formatUsd(data.costs.monthToDate.googleUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Analisi AI (OpenAI)</span>
              <span>{formatUsd(data.costs.monthToDate.aiUsd)}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-hairline-soft pt-1.5 text-xs text-muted-soft">
              <span>Oggi</span>
              <span>{formatUsd(data.costs.today.totalUsd)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-3.5 text-[13px] font-semibold">Quota Google Places — oggi</div>
          <div className="mb-2 text-[26px] font-semibold tracking-tight">
            {data.googleQuota.usedToday} / {data.googleQuota.cap}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full ${data.googleQuota.percent >= 80 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(100, data.googleQuota.percent)}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-muted-soft">{data.googleQuota.percent}% del cap giornaliero</div>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-3.5 text-[13px] font-semibold">Ricerche</div>
          <div className="mb-3 flex gap-4 text-[13px]">
            <span>
              <span className="font-semibold text-success">{data.searches.active}</span> attive
            </span>
            <span>
              <span className="font-semibold text-warning">{data.searches.paused}</span> in pausa
            </span>
            <span>
              <span className="font-semibold text-muted-foreground">{data.searches.draft}</span> bozze
            </span>
          </div>
          {data.searches.nextScheduled ? (
            <div
              className="cursor-pointer text-xs text-muted-soft underline"
              onClick={() => router.push(`/ricerche/${data.searches.nextScheduled!.id}`)}
            >
              Prossima: {data.searches.nextScheduled.title} —{" "}
              {new Date(data.searches.nextScheduled.nextRunAt).toLocaleString("it-IT")}
            </div>
          ) : (
            <div className="text-xs text-muted-soft">Nessuna ricerca ricorrente pianificata</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-1 text-[13px] font-semibold">Liste per volume</div>
          <div className="mb-3.5 text-xs text-muted-soft">{data.lists.count} liste totali</div>
          {data.lists.topByVolume.length === 0 && (
            <div className="text-xs text-muted-soft">Nessuna lista ancora</div>
          )}
          <div className="flex flex-col gap-2">
            {data.lists.topByVolume.map((l) => (
              <div
                key={l.id}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-background px-3.5 py-2.5"
                onClick={() => router.push(`/liste?list=${l.id}`)}
              >
                <span className="truncate text-[13px] font-medium">{l.name}</span>
                <span className="text-[13px] text-muted-foreground">{l.total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          <div className="mb-1 text-[13px] font-semibold">Ultimi errori</div>
          <div className="mb-3.5 text-xs text-muted-soft">
            <span
              className="cursor-pointer underline"
              onClick={() => router.push("/logs")}
            >
              Vai a Logs
            </span>{" "}
            per il dettaglio completo e i retry
          </div>
          {data.recentErrors.length === 0 && (
            <div className="text-xs text-muted-soft">Nessun errore recente 🎉</div>
          )}
          <div className="flex flex-col gap-2">
            {data.recentErrors.map((e) => (
              <div key={e.id} className="rounded-md border border-border bg-background p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {CATEGORY_LABEL[e.category] ?? e.category}
                  </span>
                  <span className="text-[11px] text-muted-soft">
                    {new Date(e.createdAt).toLocaleString("it-IT")}
                  </span>
                </div>
                <div className="truncate text-xs" title={e.message}>
                  {e.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
