/** Strip env-file / download-file wrappers so only the raw token is sent. */
export function normalizePasstokenInput(raw: string): string {
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
  return "Paste only the token starting with rb_pass_, not a PASSTOKEN= line from the download file.";
}
