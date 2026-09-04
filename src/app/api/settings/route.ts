import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret, isSecretSet } from "@/lib/crypto";

const KEYS = {
  googleApiKey: "google_places_api_key",
  quotaCap: "google_places_quota_cap",
  defaultWebhookUrl: "default_webhook_url",
  defaultWebhookSecret: "default_webhook_secret",
  bucketThresholds: "bucket_thresholds",
} as const;

async function getSetting(key: string) {
  const row = await db.integrationSetting.findUnique({ where: { key } });
  return row?.valueEncrypted ?? null;
}

export async function GET() {
  const [apiKey, quotaCap, webhookUrl, webhookSecret, thresholds] = await Promise.all([
    getSetting(KEYS.googleApiKey),
    getSetting(KEYS.quotaCap),
    getSetting(KEYS.defaultWebhookUrl),
    getSetting(KEYS.defaultWebhookSecret),
    getSetting(KEYS.bucketThresholds),
  ]);

  return NextResponse.json({
    hasApiKey: isSecretSet(apiKey),
    quotaCap: quotaCap ? Number(decryptSecret(quotaCap)) : 500,
    defaultWebhookUrl: webhookUrl ? decryptSecret(webhookUrl) : "",
    hasDefaultWebhookSecret: isSecretSet(webhookSecret),
    bucketThresholds: thresholds
      ? JSON.parse(decryptSecret(thresholds))
      : { b1: 4, b2: 8, b3: 12 },
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const writes: Promise<unknown>[] = [];

  const upsert = (key: string, value: string) =>
    db.integrationSetting.upsert({
      where: { key },
      create: { key, valueEncrypted: encryptSecret(value) },
      update: { valueEncrypted: encryptSecret(value) },
    });

  if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
    writes.push(upsert(KEYS.googleApiKey, body.apiKey));
  }
  if (body.quotaCap != null) {
    writes.push(upsert(KEYS.quotaCap, String(body.quotaCap)));
  }
  if (typeof body.defaultWebhookUrl === "string") {
    writes.push(upsert(KEYS.defaultWebhookUrl, body.defaultWebhookUrl));
  }
  if (typeof body.defaultWebhookSecret === "string" && body.defaultWebhookSecret.length > 0) {
    writes.push(upsert(KEYS.defaultWebhookSecret, body.defaultWebhookSecret));
  }
  if (body.bucketThresholds) {
    writes.push(upsert(KEYS.bucketThresholds, JSON.stringify(body.bucketThresholds)));
  }

  await Promise.all(writes);
  return NextResponse.json({ ok: true });
}
