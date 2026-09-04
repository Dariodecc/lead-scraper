import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM. ENCRYPTION_KEY è una stringa hex di 64 caratteri (32 byte) — vedi .env.example.
// Usato per i secret salvati in `integrations_settings` e `searches.outbound_webhook_secret_encrypted` (§8).
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY mancante o non valida (attesi 64 caratteri hex / 32 byte)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Formato secret cifrato non valido");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Maschera un secret per la UI: mostra solo che è impostato, mai il valore. */
export function isSecretSet(encrypted: string | null | undefined): boolean {
  return !!encrypted && encrypted.length > 0;
}
