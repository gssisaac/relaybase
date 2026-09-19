import { randomBytes } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** High-entropy 32-byte CSPRNG token for unsubscribe links (spec §5.2). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}
