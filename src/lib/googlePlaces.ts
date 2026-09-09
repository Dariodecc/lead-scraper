// Helper server-side per Google Places API (New) + Geocoding — usati dalle route /api (§4).
// La chiave non deve mai raggiungere il browser: ogni chiamata a Google passa da qui.

const PLACES_BASE = "https://places.googleapis.com/v1";

import { getGoogleApiKey } from "./settings";

export interface AreaSuggestion {
  placeId: string;
  label: string;
}

/** Autocomplete (New) — ristretto a città/comuni/aree amministrative italiane (§4). */
export async function autocompleteArea(input: string): Promise<AreaSuggestion[]> {
  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": await getGoogleApiKey(),
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["it"],
      languageCode: "it",
      includedPrimaryTypes: ["locality", "administrative_area_level_3", "postal_town"],
    }),
  });
  if (!res.ok) {
    throw new Error(`Autocomplete Places fallita: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const suggestions = (data.suggestions ?? []) as Array<{
    placePrediction?: { placeId: string; text?: { text?: string } };
  }>;
  return suggestions
    .filter((s) => s.placePrediction)
    .map((s) => ({
      placeId: s.placePrediction!.placeId,
      label: s.placePrediction!.text?.text ?? s.placePrediction!.placeId,
    }));
}

export interface AreaDetails {
  placeId: string;
  label: string;
  lat: number;
  lng: number;
  suggestedRadiusM: number | null;
}

const METERS_PER_DEGREE_LAT = 111_320;
const MIN_SUGGESTED_RADIUS_M = 1000;
const MAX_SUGGESTED_RADIUS_M = 50_000; // stesso tetto del campo raggio in UI (§ricerche)

/**
 * Stima il raggio necessario a coprire l'intero comune/città a partire dal `viewport`
 * (bounding box) che Google restituisce per un luogo amministrativo — distanza dal centro
 * all'angolo più lontano, arrotondata per eccesso. Non è il confine reale del comune (Google
 * non lo espone), ma una stima solida: è lo stesso bounding box che Google userebbe per
 * inquadrare l'area su una mappa.
 */
function suggestRadiusFromViewport(
  centerLat: number,
  centerLng: number,
  viewport?: { low?: { latitude?: number; longitude?: number }; high?: { latitude?: number; longitude?: number } },
): number | null {
  if (!viewport?.low || !viewport?.high) return null;
  const { low, high } = viewport;
  if (
    low.latitude == null ||
    low.longitude == null ||
    high.latitude == null ||
    high.longitude == null
  ) {
    return null;
  }
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const corners = [
    { lat: low.latitude, lng: low.longitude },
    { lat: low.latitude, lng: high.longitude },
    { lat: high.latitude, lng: low.longitude },
    { lat: high.latitude, lng: high.longitude },
  ];
  const maxDistM = Math.max(
    ...corners.map((c) => {
      const dLat = (c.lat - centerLat) * METERS_PER_DEGREE_LAT;
      const dLng = (c.lng - centerLng) * metersPerDegreeLng;
      return Math.sqrt(dLat * dLat + dLng * dLng);
    }),
  );
  const rounded = Math.ceil(maxDistM / 500) * 500;
  return Math.min(MAX_SUGGESTED_RADIUS_M, Math.max(MIN_SUGGESTED_RADIUS_M, rounded));
}

/** Risolve un place_id di zona in etichetta leggibile + coordinate del centro + raggio di copertura suggerito (§4). */
export async function resolveArea(placeId: string): Promise<AreaDetails> {
  const res = await fetch(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=it`,
    {
      headers: {
        "X-Goog-Api-Key": await getGoogleApiKey(),
        "X-Goog-FieldMask": "id,formattedAddress,location,displayName,viewport",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Place Details fallita: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  return {
    placeId: data.id,
    label: data.formattedAddress ?? data.displayName?.text ?? placeId,
    lat,
    lng,
    suggestedRadiusM: suggestRadiusFromViewport(lat, lng, data.viewport),
  };
}
