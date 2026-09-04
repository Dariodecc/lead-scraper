// Stima di apertura recente (§5) — NON un dato certo, va sempre presentato con la sua confidenza.
// Combina due segnali pubblici deboli: quanto è "giovane" la recensione più vecchia disponibile
// (pesata dal numero totale di recensioni) e da quanto tempo il Lead Scraper stesso traccia il
// place_id. Nessuno dei due, da solo, prova l'età reale dell'attività — vedi §5/§12.
import type { EstimatedOpeningWindow, EstimationConfidence } from "@prisma/client";

export interface BucketThresholds {
  b1: number; // mesi, soglia 0-4m
  b2: number; // mesi, soglia 4-8m
  b3: number; // mesi, soglia 8-12m
}

export const DEFAULT_BUCKET_THRESHOLDS: BucketThresholds = { b1: 4, b2: 8, b3: 12 };

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

export function estimateOpening(params: {
  now?: Date;
  firstSeenAt: Date;
  reviewCount: number | null;
  earliestReviewDate: Date | null;
  thresholds?: BucketThresholds;
}): { bucket: EstimatedOpeningWindow; confidence: EstimationConfidence } {
  const now = params.now ?? new Date();
  const thresholds = params.thresholds ?? DEFAULT_BUCKET_THRESHOLDS;

  // Segnale primario: età della recensione più vecchia disponibile, pesata dal volume totale
  // di recensioni (poche recensioni + recensione più vecchia recente = probabile attività giovane;
  // stesso segnale può però derivare da un'attività storica con scarsa presenza online — §5).
  if (params.reviewCount == null || params.reviewCount === 0 || params.earliestReviewDate == null) {
    // Nessun segnale dalle recensioni: l'unico dato è che l'abbiamo appena scoperta ora,
    // il che non prova nulla sulla sua età reale — bucket sconosciuto, confidenza bassa.
    return { bucket: "unknown", confidence: "low" };
  }

  const reviewAgeMonths = monthsBetween(params.earliestReviewDate, now);
  let bucket: EstimatedOpeningWindow;
  if (reviewAgeMonths <= thresholds.b1) bucket = "m0_4";
  else if (reviewAgeMonths <= thresholds.b2) bucket = "m4_8";
  else if (reviewAgeMonths <= thresholds.b3) bucket = "m8_12";
  else bucket = "m12_plus";

  let confidence: EstimationConfidence;
  if (params.reviewCount <= 10) confidence = "high";
  else if (params.reviewCount <= 40) confidence = "medium";
  else confidence = "low"; // molte recensioni + recensione "vecchia" recente è un segnale meno affidabile

  // Bonus di confidenza: se il Lead Scraper ha scoperto il place_id in questa stessa scansione
  // (first_seen_at praticamente ora) e il segnale recensioni concorda su "giovane", i due segnali
  // si rinforzano a vicenda (§5, "quanti segnali concordano").
  const trackedDays = (now.getTime() - params.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  const justDiscovered = trackedDays <= 1;
  if (justDiscovered && (bucket === "m0_4" || bucket === "m4_8") && confidence === "medium") {
    confidence = "high";
  }

  return { bucket, confidence };
}
