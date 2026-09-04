import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const searchRunQueue = new Queue("search-run", { connection });
export const webhookDeliveryQueue = new Queue("webhook-delivery", { connection });

export async function enqueueSearchRun(searchRunId: string) {
  await searchRunQueue.add("run", { searchRunId });
}

export async function enqueueWebhookDelivery(placeId: string) {
  await webhookDeliveryQueue.add(
    "deliver",
    { placeId },
    { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
  );
}
