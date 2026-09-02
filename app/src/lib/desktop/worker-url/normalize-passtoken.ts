export const PASSTOKEN_BACKUP_FILENAME = "relaybase-passtoken.txt";

const PASSTOKEN_BODY_RE = /rb_pass_[A-Za-z0-9_-]+/;

/**
 * Backup file body: the raw `rb_pass_…` token only.
 * Never comments, Worker URL, timestamps, or `PASSTOKEN=` — those put the
 * endpoint next to the secret and make the file look like something to paste
 * into env files.
 */
export function passtokenBackupFileContents(token: string): string {
  return token.trim();
}

/** Strip env-file / download-file wrappers so only the raw token is sent. */
export function normalizePasstokenInput(raw: string): string {
  const extracted = raw.match(PASSTOKEN_BODY_RE);
  if (extracted) return extracted[0];

  let token = raw.trim().replace(/\s+/g, "");
  if (!token) return "";

  const envMatch = token.match(/^PASSTOKEN=(.+)$/i);
  if (envMatch) {
    token = envMatch[1].trim();
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  return token;
}

export function isValidPasstokenFormat(token: string): boolean {
  const normalized = normalizePasstokenInput(token);
  return (
    normalized.startsWith("rb_pass_") &&
    normalized.length > "rb_pass_".length + 10
  );
}

export function passtokenFormatHint(): string {
  return "Paste the token starting with rb_pass_.";
}
