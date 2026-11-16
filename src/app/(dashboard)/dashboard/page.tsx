"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Plus,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LOG_CATEGORY_LABEL } from "@/components/status-badges";
import { formatDateTime, formatRelative, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function Stat({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: number;
  sub?: React.ReactNode;
  tone?: "alert";
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "num mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.025em]",
          tone === "alert" && "text-destructive-fg",
        )}
      >
        {value.toLocaleString("it-IT")}
      </div>
      {sub && <div className="mt-2 text-xs text-muted-soft">{sub}</div>}
    </>
  );
  const cls = "block px-5 py-4 transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Barra a segmenti senza "binario" di sfondo: ogni parte è etichettata nella legenda. */
function SplitBar({
  parts,
  label,
}: {
  parts: { key: string; label: string; value: number; className: string }[];
  label: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div role="img" aria-label={label} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <div
                key={p.key}
                className={cn("h-full min-w-1 transition-[flex-grow] duration-500", p.className)}
                // Proporzione normalizzata: con valori < 1 (es. dollari) un flex-grow grezzo
                // riempirebbe solo una frazione dello spazio libero.
                style={{ flexGrow: (p.value / total) * 100, flexBasis: 0 }}
              />
            ))
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", p.className)} />
            {p.label}
            <span className="num font-medium text-foreground">{p.value.toLocaleString("it-IT")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Caricamento" className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-44 w-full rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-60 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  if (failed) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Panel>
          <EmptyState
            icon={WarningCircle}
            title="Non riesco a caricare i dati"
            description="Il server non ha risposto. Riprova tra qualche istante."
            action={<Button onClick={load}>Riprova</Button>}
          />
        </Panel>
      </>
    );
  }
  if (!data) return <DashboardSkeleton />;

  const maxList = Math.max(1, ...data.lists.topByVolume.map((l) => l.total));
  const quotaHigh = data.googleQuota.percent >= 80;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Panoramica di lead, costi e stato del sistema."
        actions={
          <Link href="/ricerche/new" className={buttonVariants({ variant: "default" })}>
            <Plus weight="bold" aria-hidden />
            Nuova ricerca
          </Link>
        }
      />

      <div className="grid gap-5">
        {/* Striscia KPI: un solo pannello con divisori, non quattro card identiche */}
        <Panel className="rise overflow-hidden" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="grid grid-cols-2 divide-border max-lg:divide-y lg:grid-cols-4 lg:divide-x [&>*:nth-child(odd)]:max-lg:border-r [&>*:nth-child(odd)]:max-lg:border-border">
            <Stat label="Lead totali" value={data.leads.total} sub={`+${data.leads.newToday} oggi`} />
            <Stat label="Consegnati" value={data.leads.delivered} sub={`${data.leads.pending} in attesa`} />
            <Stat
              label="Da riprovare"
              value={data.pendingRetries}
              tone={data.pendingRetries > 0 ? "alert" : undefined}
              sub={data.pendingRetries > 0 ? "Consegna o analisi AI fallita" : "Nessuna azione richiesta"}
              href={data.pendingRetries > 0 ? "/logs" : undefined}
            />
            <Stat label="Esclusi" value={data.leads.excluded} sub="Catene e regole di lista" />
          </div>
          <div className="border-t border-border px-5 py-4">
            <SplitBar
              label="Distribuzione dei lead per stato di consegna"
              parts={[
                { key: "delivered", label: "Consegnati", value: data.leads.delivered, className: "bg-success" },
                { key: "pending", label: "Nuovi", value: data.leads.pending, className: "bg-brand" },
                { key: "failed", label: "Falliti", value: data.leads.failed, className: "bg-destructive" },
                { key: "excluded", label: "Esclusi", value: data.leads.excluded, className: "bg-warning" },
              ]}
            />
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Panel className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <PanelHeader title="Costi e quota" description="Mese corrente e consumo Google Places di oggi." />
            <PanelBody className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="text-[13px] text-muted-foreground">Costi API del mese</div>
                <div className="num mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.025em]">
                  {formatUsd(data.costs.monthToDate.totalUsd)}
                </div>
                <div className="mt-4">
                  <SplitBar
                    label="Ripartizione dei costi del mese"
                    parts={[
                      { key: "g", label: "Google", value: data.costs.monthToDate.googleUsd, className: "bg-brand" },
                      { key: "a", label: "AI", value: data.costs.monthToDate.aiUsd, className: "bg-chart-3" },
                    ]}
                  />
                </div>
                <dl className="mt-4 grid gap-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Google Places</dt>
                    <dd className="num">{formatUsd(data.costs.monthToDate.googleUsd)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Analisi AI</dt>
                    <dd className="num">{formatUsd(data.costs.monthToDate.aiUsd)}</dd>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-hairline-soft pt-2 text-muted-soft">
                    <dt>Oggi</dt>
                    <dd className="num">{formatUsd(data.costs.today.totalUsd)}</dd>
                  </div>
                </dl>
              </div>

              <div className="sm:border-l sm:border-border sm:pl-6">
                <div className="text-[13px] text-muted-foreground">Quota Google oggi</div>
                <div className="num mt-1.5 flex items-baseline gap-1.5 text-[28px] font-semibold leading-none tracking-[-0.025em]">
                  {data.googleQuota.usedToday.toLocaleString("it-IT")}
                  <span className="text-base font-medium text-muted-soft">
                    / {data.googleQuota.cap.toLocaleString("it-IT")}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Quota giornaliera Google Places"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, data.googleQuota.percent)}
                  className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 ease-out",
                      quotaHigh ? "bg-destructive" : "bg-brand",
                    )}
                    style={{ width: `${Math.min(100, data.googleQuota.percent)}%` }}
                  />
                </div>
                <p className={cn("mt-2 text-xs", quotaHigh ? "font-medium text-destructive-fg" : "text-muted-soft")}>
                  {quotaHigh
                    ? `${data.googleQuota.percent}% del cap giornaliero: vicino al limite`
                    : `${data.googleQuota.percent}% del cap giornaliero`}
                </p>
              </div>
            </PanelBody>
          </Panel>

          <Panel className="rise" style={{ "--i": 3 } as React.CSSProperties}>
            <PanelHeader
              title="Ricerche"
              actions={
                <Link href="/ricerche" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Vedi tutte
                  <ArrowRight weight="bold" aria-hidden />
                </Link>
              }
            />
            <PanelBody>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  { label: "Attive", value: data.searches.active, dot: "bg-success" },
                  { label: "In pausa", value: data.searches.paused, dot: "bg-warning" },
                  { label: "Bozze", value: data.searches.draft, dot: "bg-muted-foreground/50" },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <span aria-hidden className={cn("size-2 rounded-full", s.dot)} />
                      {s.label}
                    </dt>
                    <dd className="num mt-1 text-2xl font-semibold tracking-[-0.02em]">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 border-t border-hairline-soft pt-4 text-[13px]">
                {data.searches.nextScheduled ? (
                  <>
                    <div className="text-muted-foreground">Prossima esecuzione</div>
                    <Link
                      href={`/ricerche/${data.searches.nextScheduled.id}`}
                      className="mt-0.5 block truncate font-medium transition-colors hover:text-brand"
                    >
                      {data.searches.nextScheduled.title}
                    </Link>
                    <div className="num text-xs text-muted-soft">
                      {formatDateTime(data.searches.nextScheduled.nextRunAt)}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-soft">Nessuna ricerca ricorrente pianificata.</p>
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
          <Panel className="rise" style={{ "--i": 4 } as React.CSSProperties}>
            <PanelHeader
              title="Liste per volume"
              description={`${data.lists.count} ${data.lists.count === 1 ? "lista" : "liste"} in totale`}
            />
            {data.lists.topByVolume.length === 0 ? (
              <EmptyState
                icon={Stack}
                title="Nessuna lista ancora"
                description="Le liste raccolgono i risultati delle ricerche. Creane una dalla sezione Liste."
                action={
                  <Link href="/liste" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Vai a Liste
                  </Link>
                }
              />
            ) : (
              <ul className="p-2">
                {data.lists.topByVolume.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/liste?list=${l.id}`}
                      className="group block rounded-md px-3 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] font-medium group-hover:text-brand">{l.name}</span>
                        <span className="num text-[13px] text-muted-foreground">{l.total.toLocaleString("it-IT")}</span>
                      </div>
                      <div
                        aria-hidden
                        className="mt-2 h-1 rounded-full bg-brand/70"
                        style={{ width: `${Math.max(3, (l.total / maxList) * 100)}%` }}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="rise" style={{ "--i": 5 } as React.CSSProperties}>
            <PanelHeader
              title="Ultimi errori"
              description="Gli eventi che richiedono attenzione."
              actions={
                <Link href="/logs" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Apri Logs
                  <ArrowRight weight="bold" aria-hidden />
                </Link>
              }
            />
            {data.recentErrors.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="Nessun errore recente"
                description="Ricerche, analisi e consegne stanno girando senza intoppi."
              />
            ) : (
              <ul className="divide-y divide-hairline-soft">
                {data.recentErrors.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-destructive-fg">
                        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                        {LOG_CATEGORY_LABEL[e.category] ?? e.category}
                        {e.searchTitle && <span className="font-normal text-muted-soft">· {e.searchTitle}</span>}
                      </span>
                      <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="shrink-0 text-muted-soft">
                        {formatRelative(e.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-2 break-words font-mono text-xs text-muted-foreground" title={e.message}>
                      {e.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
