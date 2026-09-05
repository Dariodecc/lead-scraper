import type { PrismaClient } from "@prisma/client";

// Costo REALE per chiamata Google Places API (New), calcolato secondo il tariffario ufficiale a
// scaglioni di volume mensile — non una stima flat. Fonte: pagina prezzi ufficiale Google Maps
// Platform (developers.google.com/maps/billing-and-pricing/pricing), letta il 2026-09-05.
// Aggiornare queste tabelle se Google cambia il tariffario.
//
// SKU rilevanti per questo progetto (determinati dai campi nel fieldMask — Google fattura
// l'INTERA chiamata al tier più alto toccato da un qualunque campo richiesto):
// - Nearby Search: fieldMask = "places.id" soltanto → SKU "Pro" (places.id è incluso nel tier
//   Pro, non in un tier Essentials/gratuito separato).
// - Place Details: il fieldMask include "reviews" (per earliest_review_date, §5) — le
//   recensioni sono classificate come dato "Atmosphere", quindi l'intera chiamata sale al tier
//   "Enterprise + Atmosphere" anche se altri campi richiesti (rating, priceLevel, ecc.) sarebbero
//   da soli solo "Enterprise".
export type GoogleSku = "nearby_search_pro" | "place_details_enterprise_atmosphere";

interface Tier {
  upTo: number; // limite superiore (incluso) del numero cumulativo di chiamate nel mese
  rate: number; // $/chiamata in questa fascia (0 = entro il cap gratuito mensile)
}

// Free cap: 5.000 chiamate/mese. Poi $32.00/$25.60/$19.20/$9.60/$2.40 per 1000.
const NEARBY_SEARCH_PRO_TIERS: Tier[] = [
  { upTo: 5_000, rate: 0 },
  { upTo: 100_000, rate: 0.032 },
  { upTo: 500_000, rate: 0.0256 },
  { upTo: 1_000_000, rate: 0.0192 },
  { upTo: 5_000_000, rate: 0.0096 },
  { upTo: Infinity, rate: 0.0024 },
];

// Free cap: 1.000 chiamate/mese. Poi $25.00/$20.00/$15.00/$7.50/$2.28 per 1000.
const PLACE_DETAILS_ENTERPRISE_ATMOSPHERE_TIERS: Tier[] = [
  { upTo: 1_000, rate: 0 },
  { upTo: 100_000, rate: 0.025 },
  { upTo: 500_000, rate: 0.02 },
  { upTo: 1_000_000, rate: 0.015 },
  { upTo: 5_000_000, rate: 0.0075 },
  { upTo: Infinity, rate: 0.00228 },
];

function tiersFor(sku: GoogleSku): Tier[] {
  return sku === "nearby_search_pro" ? NEARBY_SEARCH_PRO_TIERS : PLACE_DETAILS_ENTERPRISE_ATMOSPHERE_TIERS;
}

function rateForCallIndex(tiers: Tier[], callIndex: number): number {
  for (const tier of tiers) {
    if (callIndex <= tier.upTo) return tier.rate;
  }
  return tiers[tiers.length - 1].rate;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Registra `callsMade` chiamate per questo SKU nel contatore mensile (incremento atomico) e
 * ritorna il costo REALE di questo batch, attraversando correttamente eventuali soglie di
 * scaglione toccate durante il batch. Va chiamata una volta per batch di chiamate fatte insieme
 * (es. tutte le Nearby Search di un run), non serve una riga per singola chiamata.
 */
export async function recordGoogleApiCalls(
  db: PrismaClient,
  sku: GoogleSku,
  callsMade: number,
): Promise<number> {
  if (callsMade <= 0) return 0;
  const month = currentMonthKey();
  const usage = await db.googleApiUsage.upsert({
    where: { month_sku: { month, sku } },
    create: { month, sku, callCount: callsMade },
    update: { callCount: { increment: callsMade } },
  });
  const priorCount = usage.callCount - callsMade;
  const tiers = tiersFor(sku);
  let cost = 0;
  for (let i = 1; i <= callsMade; i++) {
    cost += rateForCallIndex(tiers, priorCount + i);
  }
  return cost;
}
