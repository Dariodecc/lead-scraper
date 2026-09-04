import type { Place, PrismaClient } from "@prisma/client";

// Formato dei bucket sul filo, come da esempio payload in §6 (diverso dai nomi enum Prisma
// m0_4/m4_8/... che non possono iniziare con una cifra).
const WINDOW_WIRE: Record<string, string> = {
  m0_4: "0-4m",
  m4_8: "4-8m",
  m8_12: "8-12m",
  m12_plus: "12m+",
  unknown: "unknown",
};

const FIXED_KEYS = [
  "category",
  "website_url",
  "website_status",
  "rating",
  "review_count",
  "price_level",
  "business_status",
  "estimated_opening_window",
  "estimation_confidence",
  "confirmed_opening_date",
];

function rawFixedValue(place: Place, key: string): unknown {
  switch (key) {
    case "category":
      return place.category;
    case "website_url":
      return place.websiteUrl;
    case "website_status":
      return place.websiteStatus;
    case "rating":
      return place.rating != null ? Number(place.rating) : null;
    case "review_count":
      return place.reviewCount;
    case "price_level":
      return place.priceLevel;
    case "business_status":
      return place.businessStatus;
    case "estimated_opening_window":
      return WINDOW_WIRE[place.estimatedOpeningWindow] ?? place.estimatedOpeningWindow;
    case "estimation_confidence":
      return place.estimationConfidence;
    case "confirmed_opening_date":
      return place.confirmedOpeningDate
        ? place.confirmedOpeningDate.toISOString().slice(0, 10)
        : null;
    default:
      return undefined;
  }
}

/**
 * Costruisce l'oggetto `attributes` del payload (§6). Se `outboundFields` è null, include tutti
 * i campi (fissi + custom della lista) valorizzati — se è un array, solo quelli selezionati per
 * questa ricerca, anche se null (selezione esplicita dell'utente).
 */
export async function buildAttributes(
  db: PrismaClient,
  place: Place,
  outboundFields: string[] | null,
): Promise<Record<string, unknown>> {
  const customValues = await db.placeCustomValue.findMany({
    where: { placeId: place.id },
    include: { listAttribute: true },
  });
  const customMap = new Map(customValues.map((c) => [c.listAttribute.key, c.value]));

  const attributes: Record<string, unknown> = {};

  if (outboundFields) {
    for (const key of outboundFields) {
      if (FIXED_KEYS.includes(key)) {
        attributes[key] = rawFixedValue(place, key);
      } else if (customMap.has(key)) {
        attributes[key] = customMap.get(key);
      }
    }
  } else {
    for (const key of FIXED_KEYS) {
      const v = rawFixedValue(place, key);
      if (v !== null && v !== undefined) attributes[key] = v;
    }
    for (const [key, value] of customMap) {
      attributes[key] = value;
    }
  }

  return attributes;
}
