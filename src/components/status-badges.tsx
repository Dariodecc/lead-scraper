import { Badge, type Tone } from "@/components/ui/badge";
import { DELIVERY_STATUS_LABEL } from "@/lib/placeFields";

const SEARCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Attiva", tone: "success" },
  paused: { label: "In pausa", tone: "warning" },
  draft: { label: "Bozza", tone: "neutral" },
};

export function SearchStatusBadge({ status }: { status: string }) {
  const s = SEARCH_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const DELIVERY_TONE: Record<string, Tone> = {
  delivered: "success",
  failed: "danger",
  excluded: "warning",
  pending: "neutral",
};

export function DeliveryBadge({ status, previewOnly }: { status: string; previewOnly?: boolean }) {
  if (previewOnly) return <Badge tone="brand">Anteprima</Badge>;
  return <Badge tone={DELIVERY_TONE[status] ?? "neutral"}>{DELIVERY_STATUS_LABEL[status] ?? status}</Badge>;
}

const LEVEL: Record<string, { label: string; tone: Tone }> = {
  info: { label: "Info", tone: "neutral" },
  warning: { label: "Warning", tone: "warning" },
  error: { label: "Errore", tone: "danger" },
};

export function LevelBadge({ level }: { level: string }) {
  const l = LEVEL[level] ?? { label: level, tone: "neutral" as Tone };
  return <Badge tone={l.tone}>{l.label}</Badge>;
}

export function RunStatusBadge({ status }: { status: string }) {
  if (status === "done") return <Badge tone="success">Completata</Badge>;
  if (status === "failed") return <Badge tone="danger">Errore</Badge>;
  return <Badge tone="brand">In corso</Badge>;
}

export const LOG_CATEGORY_LABEL: Record<string, string> = {
  search_run: "Esecuzione ricerca",
  google_api: "Google API",
  webhook_delivery: "Consegna webhook",
  ai_analysis: "Analisi AI",
  system: "Sistema",
};
