"use client";

import { useEffect, useRef } from "react";
import type * as LeafletNS from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapCircleData {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  label: string;
  color?: string;
  href?: string;
}

const DEFAULT_COLOR = "#2563eb";
// Centro geografico approssimativo dell'Italia — vista di default quando non c'è ancora
// nessuna zona da mostrare.
const ITALY_CENTER: [number, number] = [42.5, 12.5];

/**
 * Mappa di copertura basata su Leaflet + tile OpenStreetMap (gratuito, nessuna chiave API —
 * a differenza di Google Maps JS, che richiederebbe di esporre la chiave al browser). Disegna
 * un cerchio per ogni zona di ricerca: è un'approssimazione del confine reale del comune (Google
 * non espone poligoni via API pubblica), utile per verificare a colpo d'occhio se la copertura
 * scelta ha senso, non un confine amministrativo esatto.
 */
export function CoverageMap({
  circles,
  height = 280,
}: {
  circles: MapCircleData[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerGroupRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const circlesRef = useRef(circles);
  circlesRef.current = circles;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(ITALY_CENTER, 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      drawCircles();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  function drawCircles() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!L || !map || !group) return;
    group.clearLayers();

    const current = circlesRef.current;
    if (current.length === 0) {
      map.setView(ITALY_CENTER, 5);
      return;
    }

    const bounds = L.latLngBounds(current.map((c) => [c.lat, c.lng] as [number, number]));
    for (const c of current) {
      const circle = L.circle([c.lat, c.lng], {
        radius: c.radiusM,
        color: c.color ?? DEFAULT_COLOR,
        fillColor: c.color ?? DEFAULT_COLOR,
        fillOpacity: 0.12,
        weight: 2,
      });
      circle.bindTooltip(c.label, { direction: "top", sticky: true });
      if (c.href) {
        const href = c.href;
        circle.on("click", () => {
          window.location.href = href;
        });
        circle.on("mouseover", () => map.getContainer().style.setProperty("cursor", "pointer"));
        circle.on("mouseout", () => map.getContainer().style.removeProperty("cursor"));
      }
      circle.addTo(group);
    }
    map.fitBounds(bounds.pad(0.35), { maxZoom: 13 });
  }

  useEffect(() => {
    drawCircles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(circles)]);

  return <div ref={containerRef} style={{ height }} className="w-full rounded-lg border border-border" />;
}
