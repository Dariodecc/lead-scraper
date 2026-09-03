import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const db = new PrismaClient();

// Fase 0: worker "hello world" — solo per verificare che il container si avvii, si connetta
// a Redis/Postgres e resti in ascolto. I processor reali (esecuzione ricerca, Google Places,
// arricchimento, consegna webhook) arrivano nelle fasi successive (§11 della spec).
const searchRunWorker = new Worker(
  "search-run",
  async (job) => {
    console.log(`[search-run] job ${job.id} ricevuto (processor non ancora implementato)`);
  },
  { connection },
);

searchRunWorker.on("ready", () => {
  console.log("Lead Scraper worker pronto — in ascolto sulla coda 'search-run'");
});

searchRunWorker.on("error", (err) => {
  console.error("Errore worker BullMQ:", err);
});

async function shutdown() {
  await searchRunWorker.close();
  await db.$disconnect();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
