/** Formattazioni condivise dall'interfaccia (locale it-IT). */

export function formatUsd(value: number, digits?: number): string {
  const d = digits ?? (value < 1 ? 4 : 2);
  return `$${value.toFixed(d)}`;
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

const RTF = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });

/** "3 ore fa", "ieri"… per elenchi di eventi recenti. */
export function formatRelative(iso: string | Date, now: number = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return RTF.format(Math.round(diffSec), "second");
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso);
}
