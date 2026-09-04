import { Queue } from "bullmq";
import IORedis from "ioredis";

// Lato web: solo produttore. I processor vivono nel worker (§2 — mai nel thread web).
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const searchRunQueue = new Queue("search-run", { connection });
export const webhookDeliveryQueue = new Queue("webhook-delivery", { connection });

export interface SearchRunJobData {
  searchRunId: string;
}

export interface WebhookDeliveryJobData {
  placeId: string;
}

export async function enqueueSearchRun(searchRunId: string) {
  await searchRunQueue.add("run", { searchRunId } satisfies SearchRunJobData);
}

export async function enqueueWebhookDelivery(placeId: string) {
  await webhookDeliveryQueue.add(
    "deliver",
    { placeId } satisfies WebhookDeliveryJobData,
    { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
  );
}
