"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, MapTrifold, Plus } from "@phosphor-icons/react";
import { placeTypeLabel } from "@/lib/placeTypes";
import type { MapCircleData } from "@/components/map/coverage-map";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Leaflet tocca `window` — niente SSR, si carica solo lato client dopo il mount.
const CoverageMap = dynamic(() => import("@/components/map/coverage-map").then((m) => m.CoverageMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-lg" />,
});

interface SearchWithArea {
  id: string;
  title: string;
  areaLabel: string;
  areaLat: string | null;
  areaLng: string | null;
  areaRadiusM: number;
  categoryPlaceType: string;
  status: "draft" | "active" | "paused";
  list: { name: string } | null;
}

type Filter = "all" | "active" | "paused" | "draft";

const STATUS_TOKEN: Record<string, string> = { active: "success", paused: "warning", draft: "muted" };
const STATUS_DOT: Record<string, string> = { active: "bg-success", paused: "bg-warning", draft: "bg-muted-foreground/50" };
const STATUS_LABEL: Record<string, string> = { active: "Attiva", paused: "In pausa", draft: "Bozza" };

export default function MappaPage() {
  const [searches, setSearches] = useState<SearchWithArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((data) => {
        setSearches(data.searches ?? []);
        setLoading(false);
      });
  }, []);

  const withArea = useMemo(() => searches.filter((s) => s.areaLat != null && s.areaLng != null), [searches]);
  const counts = useMemo(
    () => ({
      all: withArea.length,
      active: withArea.filter((s) => s.status === "active").length,
      paused: withArea.filter((s) => s.status === "paused").length,
      draft: withArea.filter((s) => s.status === "draft").length,
    }),
    [withArea],
  );
  const visible = useMemo(() => withArea.filter((s) => filter === "all" || s.status === filter), [withArea, filter]);

  const circles: MapCircleData[] = visible.map((s) => ({
    id: s.id,
    lat: Number(s.areaLat),
    lng: Number(s.areaLng),
    radiusM: s.areaRadiusM,
    label: `${s.title || "Nuova ricerca"} — ${s.areaLabel} (${placeTypeLabel(s.categoryPlaceType)})`,
    color: STATUS_TOKEN[s.status],
    href: `/ricerche/${s.id}`,
  }));

  return (
    <>
      <PageHeader
        title="Mappa"
        description="La copertura di tutte le ricerche. Ogni cerchio è l'area effettivamente scansionata (centro e raggio), non il confine amministrativo del comune."
      />

      {!loading && withArea.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card">
          <EmptyState
            icon={MapTrifold}
            title="Nessuna zona impostata"
            description="Le ricerche con una zona compaiono qui come cerchi sulla mappa."
            action={
              <Link href="/ricerche/new" className={buttonVariants({ variant: "default" })}>
                <Plus weight="bold" aria-hidden />
                Nuova ricerca
              </Link>
            }
          />
        </div>
      ) : (
        <div className="rise grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[344px_minmax(0,1fr)]" style={{ "--i": 1 } as React.CSSProperties}>
          <Panel className="order-2 flex min-h-0 flex-col lg:order-1 lg:h-[calc(100dvh-15rem)] lg:min-h-[480px]">
            <div className="border-b border-border p-3">
              <Segmented<Filter>
                label="Filtra per stato"
                value={filter}
                onChange={(f) => {
                  setFilter(f);
                  setActiveId(null);
                }}
                className="w-full [&>label]:flex-1 [&_span]:justify-center [&_span]:px-1.5"
                options={[
                  { value: "all", label: "Tutte", count: counts.all },
                  { value: "active", label: "Attive", count: counts.active },
                  { value: "paused", label: "Pausa", count: counts.paused },
                  { value: "draft", label: "Bozze", count: counts.draft },
                ]}
              />
            </div>
            {loading ? (
              <div className="grid gap-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <p className="p-5 text-[13px] text-muted-soft">Nessuna ricerca con questo stato.</p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 scroll-thin">
                {visible.map((s) => {
                  const active = activeId === s.id;
                  return (
                    <li key={s.id} className="group relative">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setActiveId(active ? null : s.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 pr-9 text-left transition-colors",
                          active ? "bg-brand-soft" : "hover:bg-muted/60",
                        )}
                      >
                        <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATUS_DOT[s.status])} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{s.title || "Nuova ricerca"}</span>
                          <span className="num block truncate text-xs text-muted-foreground">
                            {s.areaLabel} · {Math.round(s.areaRadiusM / 1000)} km
                          </span>
                          <span className="block truncate text-xs text-muted-soft">
                            {placeTypeLabel(s.categoryPlaceType)} · {STATUS_LABEL[s.status]}
                          </span>
                        </span>
                      </button>
                      <Link
                        href={`/ricerche/${s.id}`}
                        aria-label={`Apri la ricerca ${s.title}`}
                        className="absolute right-2 top-2.5 rounded-md p-1.5 text-muted-soft opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <ArrowUpRight size={14} weight="bold" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="order-1 h-[58dvh] min-h-[380px] lg:order-2 lg:h-[calc(100dvh-15rem)] lg:min-h-[480px]">
            <CoverageMap circles={circles} height="100%" focusId={activeId} />
          </div>
        </div>
      )}
    </>
  );
}
