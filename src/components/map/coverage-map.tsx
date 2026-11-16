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
  /** Nome di un token del tema ("brand", "success", "warning", "muted", "danger") oppure un colore CSS. */
  color?: string;
  href?: string;
}

const TOKENS: Record<string, string> = {
  brand: "--brand",
  success: "--success",
  warning: "--warning",
  muted: "--muted-foreground",
  danger: "--destructive",
};

// Leaflet scrive il colore come attributo SVG, dove var(--x) non si risolve: leggiamo il valore
// calcolato del token al momento del disegno (e ridisegniamo quando cambia il tema).
function resolveColor(color: string | undefined): string {
  const name = TOKENS[color ?? "brand"];
  if (!name) return color ?? "#3b5fcf";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#3b5fcf";
}

// Centro geografico approssimativo dell'Italia — vista di default quando non c'è ancora
// nessuna zona da mostrare.
const ITALY_CENTER: [number, number] = [42.5, 12.5];

/**
 * Mappa di copertura basata su Leaflet + tile OpenStreetMap (gratuito, nessuna chiave API —
 * a differenza di Google Maps JS, che richiederebbe di esporre la chiave al browser). Disegna
 * un cerchio per ogni zona di ricerca: è un'approssimazione del confine reale del comune (Google
 * non espone poligoni via API pubblica), utile per verificare a colpo d'occhio se la copertura
 * scelta ha senso, non un confine amministrativo esatto.
 *
 * Lo stile delle tile (desaturate / invertite in dark mode) è in globals.css.
 */
export function CoverageMap({
  circles,
  height = 280,
  focusId,
}: {
  circles: MapCircleData[];
  height?: number | string;
  /** Se presente, la vista si sposta su questo cerchio e lo evidenzia. */
  focusId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerGroupRef = useRef<LeafletNS.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const circlesRef = useRef(circles);
  circlesRef.current = circles;
  const focusRef = useRef(focusId);
  focusRef.current = focusId;

  useEffect(() => {
    let cancelled = false;
    let themeObserver: MutationObserver | null = null;

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

      // Il container può non avere ancora le dimensioni finali nel momento esatto in cui Leaflet
      // le legge (soprattutto dietro un dynamic import ssr:false) — senza invalidateSize()
      // fitBounds calcola lo zoom su una viewport 0x0 e finisce sullo zoom minimo (mondo intero).
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      // Cambio tema: i colori dei token cambiano, quindi si ridisegna.
      themeObserver = new MutationObserver(() => drawCircles(false));
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      requestAnimationFrame(() => {
        if (cancelled) return;
        map.invalidateSize();
        drawCircles();
      });
    })();

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  function drawCircles(refit = true) {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!L || !map || !group) return;
    map.invalidateSize();
    group.clearLayers();

    const current = circlesRef.current;
    if (current.length === 0) {
      if (refit) map.setView(ITALY_CENTER, 5);
      return;
    }

    const focusedId = focusRef.current;
    const bounds = L.latLngBounds(current.map((c) => [c.lat, c.lng] as [number, number]));
    let focusBounds: LeafletNS.LatLngBounds | null = null;

    for (const c of current) {
      const color = resolveColor(c.color);
      const isFocus = focusedId === c.id;
      const circle = L.circle([c.lat, c.lng], {
        radius: c.radiusM,
        color,
        fillColor: color,
        fillOpacity: isFocus ? 0.26 : 0.13,
        weight: isFocus ? 3 : 1.5,
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
      if (isFocus) focusBounds = circle.getBounds();
    }

    if (!refit) return;
    if (focusBounds) map.flyToBounds(focusBounds.pad(0.4), { maxZoom: 12, duration: 0.6 });
    else map.fitBounds(bounds.pad(0.35), { maxZoom: 13 });
  }

  useEffect(() => {
    drawCircles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(circles), focusId]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Mappa della copertura delle ricerche"
      style={{ height }}
      className="w-full overflow-hidden rounded-lg border border-border shadow-panel"
    />
  );
}
