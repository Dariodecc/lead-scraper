// Duplicato da src/lib/settings.ts (web) — vedi quel file per i commenti completi.
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./lib/crypto";

const db = new PrismaClient();

const KEYS = {
  googleApiKey: "google_places_api_key",
  quotaCap: "google_places_quota_cap",
  bucketThresholds: "bucket_thresholds",
  openAiApiKey: "openai_api_key",
  openAiInputCostPer1M: "openai_input_cost_per_1m",
  openAiOutputCostPer1M: "openai_output_cost_per_1m",
} as const;

async function read(key: string): Promise<string | null> {
  const row = await db.integrationSetting.findUnique({ where: { key } });
  return row?.valueEncrypted ? decryptSecret(row.valueEncrypted) : null;
}

export async function getGoogleApiKey(): Promise<string> {
  const fromDb = await read(KEYS.googleApiKey);
  if (fromDb) return fromDb;
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  throw new Error("Google Places API key non configurata — impostala in Impostazioni");
}

export async function getQuotaCap(): Promise<number> {
  const v = await read(KEYS.quotaCap);
  return v ? Number(v) : 500;
}

export async function getBucketThresholds(): Promise<{ b1: number; b2: number; b3: number }> {
  const v = await read(KEYS.bucketThresholds);
  return v ? JSON.parse(v) : { b1: 4, b2: 8, b3: 12 };
}

export async function getOpenAiApiKey(): Promise<string> {
  const fromDb = await read(KEYS.openAiApiKey);
  if (fromDb) return fromDb;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  throw new Error("OpenAI API key non configurata — impostala in Impostazioni");
}

// Prezzi gpt-4o-mini (2026): $0.15 / 1M token input, $0.60 / 1M token output.
export async function getOpenAiCostRates(): Promise<{ inputPer1M: number; outputPer1M: number }> {
  const [inputPer1M, outputPer1M] = await Promise.all([
    read(KEYS.openAiInputCostPer1M),
    read(KEYS.openAiOutputCostPer1M),
  ]);
  return {
    inputPer1M: inputPer1M ? Number(inputPer1M) : 0.15,
    outputPer1M: outputPer1M ? Number(outputPer1M) : 0.6,
  };
}
