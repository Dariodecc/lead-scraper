import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret, isSecretSet } from "@/lib/crypto";

const KEYS = {
  googleApiKey: "google_places_api_key",
  quotaCap: "google_places_quota_cap",
  bucketThresholds: "bucket_thresholds",
  openAiApiKey: "openai_api_key",
  googleNearbySearchCostPerCall: "google_nearby_search_cost_per_call",
  googlePlaceDetailsCostPerCall: "google_place_details_cost_per_call",
  openAiInputCostPer1M: "openai_input_cost_per_1m",
  openAiOutputCostPer1M: "openai_output_cost_per_1m",
} as const;

async function getSetting(key: string) {
  const row = await db.integrationSetting.findUnique({ where: { key } });
  return row?.valueEncrypted ?? null;
}

export async function GET() {
  const [apiKey, quotaCap, thresholds, openAiKey, nearbyCost, detailsCost, inputCost, outputCost] =
    await Promise.all([
      getSetting(KEYS.googleApiKey),
      getSetting(KEYS.quotaCap),
      getSetting(KEYS.bucketThresholds),
      getSetting(KEYS.openAiApiKey),
      getSetting(KEYS.googleNearbySearchCostPerCall),
      getSetting(KEYS.googlePlaceDetailsCostPerCall),
      getSetting(KEYS.openAiInputCostPer1M),
      getSetting(KEYS.openAiOutputCostPer1M),
    ]);

  return NextResponse.json({
    hasApiKey: isSecretSet(apiKey),
    quotaCap: quotaCap ? Number(decryptSecret(quotaCap)) : 500,
    bucketThresholds: thresholds
      ? JSON.parse(decryptSecret(thresholds))
      : { b1: 4, b2: 8, b3: 12 },
    hasOpenAiApiKey: isSecretSet(openAiKey),
    googleNearbySearchCostPerCall: nearbyCost ? Number(decryptSecret(nearbyCost)) : 0.032,
    googlePlaceDetailsCostPerCall: detailsCost ? Number(decryptSecret(detailsCost)) : 0.04,
    openAiInputCostPer1M: inputCost ? Number(decryptSecret(inputCost)) : 0.15,
    openAiOutputCostPer1M: outputCost ? Number(decryptSecret(outputCost)) : 0.6,
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
  if (body.bucketThresholds) {
    writes.push(upsert(KEYS.bucketThresholds, JSON.stringify(body.bucketThresholds)));
  }
  if (typeof body.openAiApiKey === "string" && body.openAiApiKey.length > 0) {
    writes.push(upsert(KEYS.openAiApiKey, body.openAiApiKey));
  }
  if (body.googleNearbySearchCostPerCall != null) {
    writes.push(upsert(KEYS.googleNearbySearchCostPerCall, String(body.googleNearbySearchCostPerCall)));
  }
  if (body.googlePlaceDetailsCostPerCall != null) {
    writes.push(upsert(KEYS.googlePlaceDetailsCostPerCall, String(body.googlePlaceDetailsCostPerCall)));
  }
  if (body.openAiInputCostPer1M != null) {
    writes.push(upsert(KEYS.openAiInputCostPer1M, String(body.openAiInputCostPer1M)));
  }
  if (body.openAiOutputCostPer1M != null) {
    writes.push(upsert(KEYS.openAiOutputCostPer1M, String(body.openAiOutputCostPer1M)));
  }

  await Promise.all(writes);
  return NextResponse.json({ ok: true });
}
