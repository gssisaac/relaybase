/** Spark-like distinct account colors (avoid purple/neon glow). */
export const ACCOUNT_COLOR_PALETTE = [
  "#E57373", // coral red
  "#F06292", // rose
  "#4DB6AC", // teal
  "#4FC3F7", // sky
  "#81C784", // green
  "#FFB74D", // amber
  "#A1887F", // brown
  "#90A4AE", // blue-gray
  "#FF8A65", // deep orange
  "#AED581", // light green
  "#4DD0E1", // cyan
  "#DCE775", // lime
] as const;

export type AccountColorMap = Record<string, string>;

function hashEmail(email: string): number {
  let hash = 0;
  const normalized = email.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getAccountColor(
  email: string,
  map: AccountColorMap,
): string {
  const key = email.trim().toLowerCase();
  const existing = map[key] ?? map[email];
  if (existing) return existing;
  return ACCOUNT_COLOR_PALETTE[hashEmail(key) % ACCOUNT_COLOR_PALETTE.length]!;
}

/**
 * Ensure every email has a stable color. Prefer unused palette slots first.
 */
export function ensureAccountColors(
  emails: string[],
  map: AccountColorMap,
): { nextMap: AccountColorMap; changed: boolean } {
  const nextMap: AccountColorMap = { ...map };
  let changed = false;
  const used = new Set(
    Object.values(nextMap).map((c) => c.toLowerCase()),
  );

  for (const raw of emails) {
    const email = raw.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (nextMap[key] || nextMap[email]) {
      // Normalize to lowercase key
      if (!nextMap[key] && nextMap[email]) {
        nextMap[key] = nextMap[email]!;
        delete nextMap[email];
        changed = true;
      }
      continue;
    }

    let color =
      ACCOUNT_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase())) ??
      ACCOUNT_COLOR_PALETTE[hashEmail(key) % ACCOUNT_COLOR_PALETTE.length]!;
    nextMap[key] = color;
    used.add(color.toLowerCase());
    changed = true;
  }

  return { nextMap, changed };
}
