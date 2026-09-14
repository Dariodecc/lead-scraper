"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { placeTypeLabel } from "@/lib/placeTypes";
import type { MapCircleData } from "@/components/map/coverage-map";

// Leaflet tocca `window` — niente SSR, si carica solo lato client dopo il mount.
const CoverageMap = dynamic(() => import("@/components/map/coverage-map").then((m) => m.CoverageMap), {
  ssr: false,
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

const STATUS_COLOR: Record<string, string> = {
  active: "#16a34a",
  paused: "#d97706",
  draft: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = { active: "Attiva", paused: "In pausa", draft: "Bozza" };

export default function MappaPage() {
  const [searches, setSearches] = useState<SearchWithArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/searches")
      .then((r) => r.json())
      .then((data) => {
        setSearches(data.searches ?? []);
        setLoading(false);
      });
  }, []);

  const withArea = searches.filter((s) => s.areaLat != null && s.areaLng != null);
  const circles: MapCircleData[] = withArea.map((s) => ({
    id: s.id,
    lat: Number(s.areaLat),
    lng: Number(s.areaLng),
    radiusM: s.areaRadiusM,
    label: `${s.title || "Nuova ricerca"} — ${s.areaLabel} (${placeTypeLabel(s.categoryPlaceType)})`,
    color: STATUS_COLOR[s.status],
    href: `/ricerche/${s.id}`,
  }));

  return (
    <div className="px-12 pb-12 pt-10">
      <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight">Mappa</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Copertura di tutte le ricerche a colpo d&apos;occhio — ogni cerchio è l&apos;area
        effettivamente scansionata (centro + raggio), non il confine amministrativo esatto del
        comune, che Google non espone via API. Clicca un cerchio per aprire la ricerca.
      </p>

      <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
        {(["active", "paused", "draft"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[s] }}
            />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <CoverageMap circles={circles} height={560} />

      {!loading && withArea.length === 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Nessuna ricerca con una zona impostata ancora — crea una ricerca da{" "}
          <Link href="/ricerche/new" className="underline">
            Ricerche
          </Link>
          .
        </div>
      )}
    </div>
  );
}
