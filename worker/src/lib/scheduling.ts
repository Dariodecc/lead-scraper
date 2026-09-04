// Duplicato da src/lib/scheduling.ts (web) — vedi quel file per i commenti completi.
import { DateTime } from "luxon";

const ZONE = "Europe/Rome";

export function computeNextRunAt(params: {
  frequency: "once" | "weekly" | "monthly";
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  time: string;
  from?: DateTime;
}): Date | null {
  const { frequency, dayOfWeek, dayOfMonth, time } = params;
  const from = params.from ?? DateTime.now().setZone(ZONE);
  const [hour, minute] = time.split(":").map(Number);

  if (frequency === "once") return null;

  if (frequency === "weekly") {
    if (dayOfWeek == null) throw new Error("schedule_day_of_week richiesto per frequency=weekly");
    const candidate = from.set({ hour, minute, second: 0, millisecond: 0 });
    const candidateJsDay = candidate.weekday % 7;
    const diffDays = (dayOfWeek - candidateJsDay + 7) % 7;
    let next = candidate.plus({ days: diffDays });
    if (next <= from) next = next.plus({ days: 7 });
    return next.toJSDate();
  }

  if (dayOfMonth == null) throw new Error("schedule_day_of_month richiesto per frequency=monthly");
  const clampToMonth = (month: DateTime) => {
    const lastDay = month.daysInMonth ?? 28;
    const day = Math.min(dayOfMonth, lastDay);
    return month.set({ day, hour, minute, second: 0, millisecond: 0 });
  };

  let next = clampToMonth(from.startOf("month"));
  if (next <= from) {
    next = clampToMonth(from.startOf("month").plus({ months: 1 }));
  }
  return next.toJSDate();
}
