// Duplicato da src/lib/openingEstimate.ts (web) — vedi quel file per i commenti completi.
import type { EstimatedOpeningWindow, EstimationConfidence } from "@prisma/client";

export interface BucketThresholds {
  b1: number;
  b2: number;
  b3: number;
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

  if (params.reviewCount == null || params.reviewCount === 0 || params.earliestReviewDate == null) {
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
  else confidence = "low";

  const trackedDays = (now.getTime() - params.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  const justDiscovered = trackedDays <= 1;
  if (justDiscovered && (bucket === "m0_4" || bucket === "m4_8") && confidence === "medium") {
    confidence = "high";
  }

  return { bucket, confidence };
}
