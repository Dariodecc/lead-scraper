import { Worker } from "bullmq";
import { connection } from "./queue";
import { processSearchRun } from "./processors/searchRun";
import { processWebhookDelivery } from "./processors/webhookDelivery";
import { startScheduler } from "./scheduler";
import { closeBrowser } from "./websiteCheck";

const searchRunWorker = new Worker("search-run", processSearchRun, { connection, concurrency: 1 });
const webhookDeliveryWorker = new Worker("webhook-delivery", processWebhookDelivery, {
  connection,
  concurrency: 5,
});

searchRunWorker.on("ready", () => console.log("Lead Scraper worker pronto — coda 'search-run'"));
webhookDeliveryWorker.on("ready", () => console.log("Lead Scraper worker pronto — coda 'webhook-delivery'"));
searchRunWorker.on("failed", (job, err) => console.error(`search-run ${job?.id} fallito:`, err));
webhookDeliveryWorker.on("failed", (job, err) => console.error(`webhook-delivery ${job?.id} fallito:`, err));

startScheduler();

async function shutdown() {
  await Promise.all([searchRunWorker.close(), webhookDeliveryWorker.close(), closeBrowser()]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
