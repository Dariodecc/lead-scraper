import { db } from "./db";
import { decryptSecret } from "./crypto";

const KEYS = {
  googleApiKey: "google_places_api_key",
  quotaCap: "google_places_quota_cap",
  bucketThresholds: "bucket_thresholds",
} as const;

async function read(key: string): Promise<string | null> {
  const row = await db.integrationSetting.findUnique({ where: { key } });
  return row?.valueEncrypted ? decryptSecret(row.valueEncrypted) : null;
}

/**
 * La chiave si configura da Impostazioni (§7.4) e vive cifrata in `integrations_settings`.
 * GOOGLE_MAPS_API_KEY (env) resta solo un fallback per non bloccare i test prima del primo
 * salvataggio da UI.
 */
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
