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
}

/** Risolve un place_id di zona in etichetta leggibile + coordinate del centro (§4). */
export async function resolveArea(placeId: string): Promise<AreaDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": await getGoogleApiKey(),
      "X-Goog-FieldMask": "id,formattedAddress,location,displayName",
    },
  });
  if (!res.ok) {
    throw new Error(`Place Details fallita: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    placeId: data.id,
    label: data.formattedAddress ?? data.displayName?.text ?? placeId,
    lat: data.location?.latitude,
    lng: data.location?.longitude,
  };
}
