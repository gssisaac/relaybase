import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function vaultKey(): Buffer {
  const secret =
    process.env.HQ_VAULT_SECRET?.trim() ||
    process.env.HQ_JWT_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-hq-vault-secret-change-me");
  if (!secret) {
    throw new Error("HQ_VAULT_SECRET or HQ_JWT_SECRET is required to store passtokens");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt owner passtoken for Cloud-side storage (never returned to browsers). */
export function encryptPasstoken(plaintext: string): string {
  const key = vaultKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptPasstoken(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid passtoken vault payload");
  }
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const key = vaultKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
