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

/** Sanitize an arbitrary Cloudflare account name or ID into a clean lowercase base username. */
export function sanitizeUsernameSlug(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  // 32-char hex Cloudflare account ID
  if (/^[a-f0-9]{32}$/.test(trimmed)) {
    return `relay-${trimmed.slice(0, 6)}`;
  }
  let slug = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 20) {
    slug = slug.slice(0, 20).replace(/-+$/, "");
  }
  if (slug.length < 3) {
    const safe = trimmed.replace(/[^a-z0-9]/g, "").slice(-6) || "user";
    slug = `relay-${safe}`;
  }
  return slug;
}

/** Given a candidate base username, check if taken. If taken, append 3 random digits like `{base}-321`. */
export function resolveAvailableUsername(
  baseInput: string,
  isAvailable: (username: string) => boolean,
): string {
  const base = sanitizeUsernameSlug(baseInput);
  if (!validateUsername(base) && isAvailable(base)) {
    return base;
  }
  for (let i = 0; i < 50; i += 1) {
    const randomSuffix = Math.floor(Math.random() * 900) + 100; // 100-999 (3 digits)
    const candidate = `${base.replace(/-+$/, "")}-${randomSuffix}`;
    if (!validateUsername(candidate) && isAvailable(candidate)) {
      return candidate;
    }
  }
  return `${base.slice(0, 16)}-${Date.now().toString(36).slice(-4)}`;
}

export function suggestUsernameWithSuffix(base: string, taken: (u: string) => boolean): string {
  return resolveAvailableUsername(base, (name) => !taken(name));
}

/** Public alias for signup username suggestion from CF account name or id. */
export function generateAvailableUsername(
  baseInput: string,
  isAvailable: (username: string) => boolean,
): string {
  return resolveAvailableUsername(baseInput, isAvailable);
}
