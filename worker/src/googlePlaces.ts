// Chiamate Google Places API (New) dal worker di scansione (§4). Due passaggi, come da spec:
// Nearby Search per l'elenco di place_id nella zona/categoria, poi Place Details per ogni
// risultato con il fieldMask completo. Un'unica chiamata Nearby Search con fieldMask esteso
// sarebbe più economica in quota, ma la spec descrive esplicitamente il flusso in due passi —
// si resta su quello, più prevedibile rispetto a un'ottimizzazione non verificata.

import { getGoogleApiKey } from "./settings";

const PLACES_BASE = "https://places.googleapis.com/v1";

// Limite reale di Nearby Search (New): max 20 risultati per chiamata, raggio max 50km (§12 nota aperta).
export const NEARBY_MAX_RESULTS = 20;
export const MAX_RADIUS_M = 50000;

const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,nationalPhoneNumber,primaryType,websiteUri,rating,userRatingCount,priceLevel,businessStatus,regularOpeningHours,reviews,openingDate";

interface NearbySearchResponse {
  places?: { id: string }[];
}

interface PlaceDetailsResponse {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  primaryType?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: string;
  reviews?: { publishTime?: string }[];
  openingDate?: string;
}

export async function nearbySearchPlaceIds(params: {
  lat: number;
  lng: number;
  radiusM: number;
  includedType: string;
  maxResultCount?: number;
}): Promise<string[]> {
  const radius = Math.min(params.radiusM, MAX_RADIUS_M);
  const res = await fetch(`${PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": await getGoogleApiKey(),
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({
      includedTypes: [params.includedType],
      maxResultCount: params.maxResultCount ?? NEARBY_MAX_RESULTS,
      locationRestriction: {
        circle: { center: { latitude: params.lat, longitude: params.lng }, radius },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Nearby Search fallita: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as NearbySearchResponse;
  return (data.places ?? []).map((p) => p.id);
}

export interface PlaceDetailsResult {
  placeId: string;
  businessName: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  category: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: "operational" | "closed_temporarily" | "closed_permanently" | null;
  earliestReviewDate: Date | null;
  confirmedOpeningDate: Date | null;
}

const BUSINESS_STATUS_MAP: Record<string, PlaceDetailsResult["businessStatus"]> = {
  OPERATIONAL: "operational",
  CLOSED_TEMPORARILY: "closed_temporarily",
  CLOSED_PERMANENTLY: "closed_permanently",
};

// priceLevel (New) è una stringa enum ("PRICE_LEVEL_INEXPENSIVE", ...) — mappata sulla scala 1-4
// usata nello schema (§8), coerente con l'uso di price_level come size proxy (§5).
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": await getGoogleApiKey(),
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });
  if (!res.ok) {
    throw new Error(`Place Details fallita: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as PlaceDetailsResponse;

  const reviews = data.reviews ?? [];
  const reviewDates = reviews
    .map((r) => (r.publishTime ? new Date(r.publishTime) : null))
    .filter((d): d is Date => d != null);
  const earliestReviewDate =
    reviewDates.length > 0
      ? new Date(Math.min(...reviewDates.map((d) => d.getTime())))
      : null;

  return {
    placeId: data.id,
    businessName: data.displayName?.text ?? "",
    address: data.formattedAddress ?? "",
    lat: data.location?.latitude ?? 0,
    lng: data.location?.longitude ?? 0,
    phone: data.nationalPhoneNumber ?? null,
    category: data.primaryType ?? null,
    websiteUrl: data.websiteUri ?? null,
    rating: data.rating ?? null,
    reviewCount: data.userRatingCount ?? null,
    priceLevel: data.priceLevel ? (PRICE_LEVEL_MAP[data.priceLevel] ?? null) : null,
    businessStatus: data.businessStatus ? BUSINESS_STATUS_MAP[data.businessStatus] ?? null : null,
    earliestReviewDate,
    confirmedOpeningDate: data.openingDate ? new Date(data.openingDate) : null,
  };
}
