/** Default Relaybase Worker URL pattern: relaybase-api.{account}.workers.dev */

export function normalizeWorkerUrl(raw: string | undefined | null): string {
  return raw?.trim().replace(/\/$/, "") ?? "";
}

/** Build the standard workers.dev URL from a Cloudflare account / subdomain slug. */
export function buildDefaultWorkerUrl(accountName: string): string {
  const slug = accountName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!slug) return "";
  return `https://relaybase-api.${slug}.workers.dev`;
}

/** Extract the subdomain slug when the URL matches the default pattern. */
export function parseDefaultWorkerSubdomain(url: string): string | null {
  const normalized = normalizeWorkerUrl(url);
  const match = normalized.match(
    /^https:\/\/relaybase-api\.([a-z0-9-]+)\.workers\.dev$/i,
  );
  return match ? match[1].toLowerCase() : null;
}

export function isValidWorkerUrl(url: string): boolean {
  const normalized = normalizeWorkerUrl(url);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
