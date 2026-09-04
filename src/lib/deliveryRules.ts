// Filtro di invio al webhook, a livello di Lista (non Impostazioni, non per-ricerca).
// Un risultato che non passa resta salvato (dedup globale, visibilità in Lista) ma non viene
// mai accodato alla consegna — delivery_status diventa "excluded". Tutte le condizioni sono in
// AND. La rilevazione catene è separata (excludeChainsThreshold su List) perché non richiede
// una lista di nomi da mantenere: si basa sulle ripetizioni osservate nella lista stessa.

export const DELIVERY_RULE_FIELDS = [
  { key: "website_status", label: "Stato sito", kind: "select", options: ["none", "outdated", "ok"] },
  { key: "rating", label: "Rating", kind: "number" },
  { key: "review_count", label: "N. recensioni", kind: "number" },
  { key: "price_level", label: "Fascia prezzo (1-4)", kind: "number" },
  { key: "category", label: "Categoria (Place Type)", kind: "text" },
  {
    key: "business_status",
    label: "Stato attività",
    kind: "select",
    options: ["operational", "closed_temporarily", "closed_permanently"],
  },
  {
    key: "estimated_opening_window",
    label: "Apertura stimata",
    kind: "select",
    options: ["m0_4", "m4_8", "m8_12", "m12_plus", "unknown"],
  },
  {
    key: "estimation_confidence",
    label: "Confidenza stima",
    kind: "select",
    options: ["low", "medium", "high"],
  },
  { key: "business_name", label: "Nome attività", kind: "text" },
] as const;

export type DeliveryRuleFieldKey = (typeof DELIVERY_RULE_FIELDS)[number]["key"];

export const DELIVERY_RULE_OPERATORS = [
  { key: "eq", label: "è uguale a" },
  { key: "neq", label: "è diverso da" },
  { key: "in", label: "è uno tra (separati da virgola)" },
  { key: "not_in", label: "non è tra (separati da virgola)" },
  { key: "gte", label: "è almeno" },
  { key: "lte", label: "è al massimo" },
  { key: "contains_any", label: "contiene una di (separati da virgola)" },
  { key: "not_contains_any", label: "non contiene nessuna di (separati da virgola)" },
] as const;

export type DeliveryRuleOperator = (typeof DELIVERY_RULE_OPERATORS)[number]["key"];

export interface DeliveryRuleCondition {
  field: DeliveryRuleFieldKey | string;
  operator: DeliveryRuleOperator;
  value: string;
}

export interface DeliveryRules {
  conditions: DeliveryRuleCondition[];
}

export function fieldLabel(key: string): string {
  return DELIVERY_RULE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

export function operatorLabel(key: string): string {
  return DELIVERY_RULE_OPERATORS.find((o) => o.key === key)?.label ?? key;
}
