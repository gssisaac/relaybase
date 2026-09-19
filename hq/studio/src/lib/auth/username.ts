const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 32) return "Username must be at most 32 characters.";
  if (!USERNAME_RE.test(username)) {
    return "Use lowercase letters, numbers, and hyphens (not at the start or end).";
  }
  return null;
}

/** Suggest a default username from Cloudflare account id (stable, not guessable). */
export function suggestUsernameFromCfAccountId(cfAccountId: string): string {
  const slug = cfAccountId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const tail = slug.slice(-6) || "cloud";
  return `relay-${tail}`;
}

export function suggestUsernameWithSuffix(base: string, taken: (u: string) => boolean): string {
  const normalized = normalizeUsername(base);
  if (!validateUsername(normalized) && !taken(normalized)) return normalized;
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${normalized.replace(/-+$/, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
    if (!validateUsername(candidate) && !taken(candidate)) return candidate;
  }
  return `${normalized}-${Date.now().toString(36).slice(-4)}`;
}
