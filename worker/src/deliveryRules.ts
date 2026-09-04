// Valutatore del filtro di invio a livello di Lista — vedi src/lib/deliveryRules.ts (web) per i
// tipi condivisi e i commenti completi sul design.
import type { Place } from "@prisma/client";

export interface DeliveryRuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface DeliveryRules {
  conditions: DeliveryRuleCondition[];
}

function fieldValue(place: Place, field: string): string | number | null {
  switch (field) {
    case "website_status":
      return place.websiteStatus;
    case "rating":
      return place.rating != null ? Number(place.rating) : null;
    case "review_count":
      return place.reviewCount;
    case "price_level":
      return place.priceLevel;
    case "category":
      return place.category;
    case "business_status":
      return place.businessStatus;
    case "estimated_opening_window":
      return place.estimatedOpeningWindow;
    case "estimation_confidence":
      return place.estimationConfidence;
    case "business_name":
      return place.businessName;
    default:
      return null;
  }
}

function parseList(value: string): string[] {
  return value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function checkCondition(place: Place, cond: DeliveryRuleCondition): boolean {
  const raw = fieldValue(place, cond.field);
  if (raw == null) return false; // campo non valorizzato: non soddisfa una condizione su di esso

  const strRaw = String(raw).toLowerCase();

  switch (cond.operator) {
    case "eq":
      return strRaw === cond.value.trim().toLowerCase();
    case "neq":
      return strRaw !== cond.value.trim().toLowerCase();
    case "in":
      return parseList(cond.value).includes(strRaw);
    case "not_in":
      return !parseList(cond.value).includes(strRaw);
    case "gte":
      return typeof raw === "number" && raw >= Number(cond.value);
    case "lte":
      return typeof raw === "number" && raw <= Number(cond.value);
    case "contains_any":
      return parseList(cond.value).some((v) => strRaw.includes(v));
    case "not_contains_any":
      return !parseList(cond.value).some((v) => strRaw.includes(v));
    default:
      return true;
  }
}

/** Ritorna { allowed: true } se il risultato passa tutte le condizioni (AND), altrimenti il motivo del primo fallimento. */
export function evaluateDeliveryRules(
  place: Place,
  rules: DeliveryRules | null,
): { allowed: boolean; reason?: string } {
  if (!rules || rules.conditions.length === 0) return { allowed: true };

  for (const cond of rules.conditions) {
    if (!checkCondition(place, cond)) {
      return {
        allowed: false,
        reason: `${cond.field} ${cond.operator} ${cond.value}`,
      };
    }
  }
  return { allowed: true };
}
