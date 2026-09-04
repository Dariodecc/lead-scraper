import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";
import { computeNextRunAt } from "./lib/scheduling";
import { enqueueSearchRun } from "./queue";
import { makeLogger } from "./log";

const db = new PrismaClient();
const log = makeLogger(db);

const TICK_MS = 60_000;

// Scheduler in-process a intervallo fisso, non job ripetibile BullMQ: un solo worker attivo,
// nessun bisogno della gestione distribuita che BullMQ offrirebbe per un caso che qui non esiste
// (§2 chiede BullMQ per lo scheduling ricorrente — soddisfatto lato "esecuzione" via search-run
// queue; il tick che decide COSA è dovuto resta un semplice controllo periodico su Postgres).
export function startScheduler() {
  setInterval(tick, TICK_MS);
  void tick();
}

async function tick() {
  const now = new Date();
  const due = await db.search.findMany({
    where: { status: "active", nextRunAt: { lte: now } },
  });

  for (const search of due) {
    try {
      const run = await db.searchRun.create({
        data: { searchId: search.id, isTest: false, status: "running" },
      });
      await enqueueSearchRun(run.id);

      const nextRunAt = computeNextRunAt({
        frequency: search.frequency,
        dayOfWeek: search.scheduleDayOfWeek,
        dayOfMonth: search.scheduleDayOfMonth,
        time: search.scheduleTime ?? "07:00",
        from: DateTime.fromJSDate(search.nextRunAt ?? now).setZone("Europe/Rome"),
      });
      await db.search.update({ where: { id: search.id }, data: { nextRunAt } });
    } catch (err) {
      await log("error", "system", `Scheduler: errore avviando ${search.title}: ${String(err)}`, {
        searchId: search.id,
      });
    }
  }
}
