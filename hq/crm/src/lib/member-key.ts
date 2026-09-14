/** URL-safe tracking key for an audience member email (open/click pixels). */
export function memberKeyFromEmail(email: string): string {
  return Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
}

export function emailFromMemberKey(key: string): string | null {
  try {
    return Buffer.from(key, "base64url").toString("utf8").trim().toLowerCase() || null;
  } catch {
    return null;
  }
}
