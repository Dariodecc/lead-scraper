import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../lib/crypto";
import { getDefaultWebhook } from "../settings";
import { buildAttributes } from "../webhookPayload";
import { makeLogger } from "../log";

const db = new PrismaClient();
const log = makeLogger(db);

interface WebhookDeliveryJobData {
  placeId: string;
}

export async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>) {
  const place = await db.place.findUnique({ where: { id: job.data.placeId } });
  if (!place) return;

  // Una Lista può essere alimentata da più ricerche (§7.2) — non tracciamo su `places` quale
  // ricerca specifica ha scoperto ogni risultato, quindi per URL/secret/campi per-ricerca si usa
  // la prima ricerca collegata a questa lista (stessa convenzione usata per l'assegnazione lista
  // in caso di collisione, §4). Semplificazione dichiarata per il caso multi-ricerca-per-lista.
  const search = await db.search.findFirst({
    where: { listId: place.listId },
    orderBy: { createdAt: "asc" },
  });

  const defaultWebhook = await getDefaultWebhook();
  const url = search?.outboundWebhookUrl || defaultWebhook.url;

  if (!url) {
    await log(
      "warning",
      "webhook_delivery",
      "Nessun webhook configurato (né per-ricerca né di default) — consegna saltata",
      { placeId: place.id, searchId: search?.id },
    );
    return;
  }

  const secret = search?.outboundWebhookSecretEncrypted
    ? decryptSecret(search.outboundWebhookSecretEncrypted)
    : defaultWebhook.secret;

  const outboundFields = (search?.outboundFields as string[] | null) ?? null;
  const attributes = await buildAttributes(db, place, outboundFields);

  const payload = {
    event: "lead.discovered",
    place_id: place.placeId,
    business_name: place.businessName,
    address: place.address,
    lat: Number(place.lat),
    lng: Number(place.lng),
    phone: place.phone,
    attributes,
    discovered_at: place.firstSeenAt.toISOString(),
  };

  const attempts = job.attemptsMade + 1;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await db.place.update({
      where: { id: place.id },
      data: { deliveryStatus: "delivered", deliveryAttempts: attempts, lastDeliveryAttemptAt: new Date() },
    });
    await log("info", "webhook_delivery", "Consegna riuscita", { placeId: place.id, searchId: search?.id });
  } catch (err) {
    const isLastAttempt = attempts >= (job.opts.attempts ?? 1);
    await db.place.update({
      where: { id: place.id },
      data: {
        deliveryStatus: isLastAttempt ? "failed" : "pending",
        deliveryAttempts: attempts,
        lastDeliveryAttemptAt: new Date(),
      },
    });
    await log(
      "error",
      "webhook_delivery",
      `Consegna fallita (tentativo ${attempts}): ${String(err)}`,
      { placeId: place.id, searchId: search?.id, payload: { attempts } },
    );
    throw err; // fa scattare retry/backoff di BullMQ (attempts:5, §6)
  }
}
