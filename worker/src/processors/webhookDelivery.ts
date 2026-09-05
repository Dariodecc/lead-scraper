import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "../lib/crypto";
import { buildAttributes } from "../webhookPayload";
import { makeLogger } from "../log";
import { checkWebsiteStatus } from "../websiteCheck";
import { runAiAnalysisForPlace, AI_ANALYSIS_ATTR_KEY, AI_SCORE_ATTR_KEY } from "../aiAnalysis";

const db = new PrismaClient();
const log = makeLogger(db);

interface WebhookDeliveryJobData {
  placeId: string;
}

export async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>) {
  const place = await db.place.findUnique({ where: { id: job.data.placeId }, include: { list: true } });
  if (!place) return;
  const list = place.list;

  // Gate analisi→consegna: se questo job arriva da un "Riprova adesso" dopo un fallimento AI
  // (place senza i due campi custom noti), si ritenta l'analisi PRIMA di consegnare — nessun
  // testo di pagina in cache in questo path, si rilegge il sito. Se fallisce di nuovo, il place
  // resta "failed" e la funzione si ferma qui senza inviare nulla (nessun retry automatico:
  // serve un nuovo click manuale su "Riprova adesso", stessa UX delle consegne fallite).
  if (list.aiAnalysisEnabled) {
    const [analysisValue, scoreValue] = await Promise.all([
      db.placeCustomValue.findFirst({
        where: { placeId: place.id, listAttribute: { listId: list.id, key: AI_ANALYSIS_ATTR_KEY } },
      }),
      db.placeCustomValue.findFirst({
        where: { placeId: place.id, listAttribute: { listId: list.id, key: AI_SCORE_ATTR_KEY } },
      }),
    ]);
    if (!analysisValue || !scoreValue) {
      const websiteCheck = place.websiteUrl ? await checkWebsiteStatus(place.websiteUrl) : null;
      const aiResult = await runAiAnalysisForPlace(db, place, list, { websiteCheck });
      if (!aiResult.success) {
        await db.place.update({ where: { id: place.id }, data: { deliveryStatus: "failed" } });
        return;
      }
      if (aiResult.excludeFromPipeline) {
        await db.place.update({ where: { id: place.id }, data: { deliveryStatus: "excluded" } });
        await log(
          "info",
          "webhook_delivery",
          `Escluso dall'invio (esclusa dall'analisi AI${aiResult.excludeReason ? `: ${aiResult.excludeReason}` : ""})`,
          { placeId: place.id },
        );
        return;
      }
    }
  }

  const url = list.outboundWebhookUrl;
  if (!url) {
    await log("warning", "webhook_delivery", "Nessun webhook configurato sulla lista — consegna saltata", {
      placeId: place.id,
    });
    return;
  }

  const secret = list.outboundWebhookSecretEncrypted ? decryptSecret(list.outboundWebhookSecretEncrypted) : null;
  const outboundFields = (list.outboundFields as string[] | null) ?? null;
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
    await log("info", "webhook_delivery", "Consegna riuscita", { placeId: place.id });
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
      { placeId: place.id, payload: { attempts } },
    );
    throw err; // fa scattare retry/backoff di BullMQ (attempts:5, §6)
  }
}
