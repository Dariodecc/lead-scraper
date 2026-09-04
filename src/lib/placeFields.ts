// Campi fissi di sistema su `places` (§8) selezionabili per il payload webhook di una ricerca
// (§4) e come colonne di una Lista (§7.2) — mix con gli eventuali `list_attributes` custom.
export const FIXED_PLACE_FIELDS = [
  { key: "category", label: "Categoria" },
  { key: "website_url", label: "URL sito" },
  { key: "website_status", label: "Stato sito" },
  { key: "rating", label: "Rating" },
  { key: "review_count", label: "N. recensioni" },
  { key: "price_level", label: "Fascia prezzo" },
  { key: "business_status", label: "Stato attività" },
  { key: "estimated_opening_window", label: "Apertura stimata" },
  { key: "estimation_confidence", label: "Confidenza stima" },
  { key: "confirmed_opening_date", label: "Data apertura confermata" },
] as const;

export type FixedPlaceFieldKey = (typeof FIXED_PLACE_FIELDS)[number]["key"];

export const WEBSITE_STATUS_LABEL: Record<string, string> = {
  none: "Assente",
  outdated: "Datato",
  ok: "Ok",
};

export const BUCKET_LABEL: Record<string, string> = {
  m0_4: "0-4 mesi",
  m4_8: "4-8 mesi",
  m8_12: "8-12 mesi",
  m12_plus: "12+ mesi",
  unknown: "Sconosciuto",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

export const BUSINESS_STATUS_LABEL: Record<string, string> = {
  operational: "Aperta",
  closed_temporarily: "Chiusa temporaneamente",
  closed_permanently: "Chiusa definitivamente",
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending: "Nuovo",
  delivered: "Consegnato",
  failed: "Fallito",
};

interface PlaceLike {
  category: string | null;
  websiteUrl: string | null;
  websiteStatus: string;
  rating: unknown;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  confirmedOpeningDate: Date | string | null;
}

const PRICE_LEVEL_LABEL: Record<number, string> = {
  1: "€ — economico",
  2: "€€ — medio",
  3: "€€€ — alto",
  4: "€€€€ — molto alto",
};

/** Valore leggibile di un campo fisso per la tabella di una Lista (§7.2). */
export function resolveFixedFieldDisplay(place: PlaceLike, key: FixedPlaceFieldKey | string): string {
  switch (key) {
    case "category":
      return place.category ?? "—";
    case "website_url":
      return place.websiteUrl ?? "—";
    case "website_status":
      return WEBSITE_STATUS_LABEL[place.websiteStatus] ?? place.websiteStatus;
    case "rating":
      return place.rating != null ? `${place.rating}★ (${place.reviewCount ?? 0})` : "—";
    case "review_count":
      return place.reviewCount != null ? String(place.reviewCount) : "—";
    case "price_level":
      return place.priceLevel != null ? PRICE_LEVEL_LABEL[place.priceLevel] ?? "—" : "Non disponibile";
    case "business_status":
      return place.businessStatus ? BUSINESS_STATUS_LABEL[place.businessStatus] ?? place.businessStatus : "—";
    case "estimated_opening_window":
      return BUCKET_LABEL[place.estimatedOpeningWindow] ?? place.estimatedOpeningWindow;
    case "estimation_confidence":
      return CONFIDENCE_LABEL[place.estimationConfidence] ?? place.estimationConfidence;
    case "confirmed_opening_date":
      return place.confirmedOpeningDate
        ? new Date(place.confirmedOpeningDate).toLocaleDateString("it-IT")
        : "—";
    default:
      return "—";
  }
}
