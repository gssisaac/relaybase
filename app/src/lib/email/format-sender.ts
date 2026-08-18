/**
 * Display helpers for the inbox "From" column and related sender surfaces.
 *
 * The Worker now stores the MIME `From:` address as `fromEmail` and the MIME
 * display name as `fromName`, but legacy rows (and some bounce/DSN messages)
 * still carry the envelope sender — which for mailing-list mail is a VERP
 * path like `bounce+abc=user@example.com`. These helpers turn whatever we have
 * into a human-readable label and a short avatar initial.
 */

const VERP_PREFIXES = [
  "bounce+",
  "bounces+",
  "bounces-",
  "bounce-",
  "bounce@",
  "bounces@",
  "mailer-daemon@",
  "postmaster@",
  "msprvs",
];

function looksLikeBounceOrDaemon(address: string): boolean {
  const lower = address.trim().toLowerCase();
  if (!lower) return false;
  // VERP-style: local part contains "=" mapping (e.g. "bounce+abc.63a-user=host@")
  if (/^bounce[s]?[+-]/.test(lower)) return true;
  if (lower.includes("=") && /bounce|bounces|msprvs/.test(lower)) return true;
  return VERP_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Render a sender as a single display string.
 *
 * - Non-empty `fromName` wins (the MIME display name).
 * - Otherwise, if the address looks like a VERP/bounce/daemon envelope path,
 *   fall back to a friendly "Mail Delivery System" label so the inbox never
 *   shows a raw `bounce+…` string.
 * - Otherwise return the address as-is (a normal `user@example.com`).
 */
export function formatSenderDisplay(
  fromName?: string | null,
  fromEmail?: string,
): string {
  const name = fromName?.trim();
  if (name) return name;

  const address = (fromEmail ?? "").trim();
  if (!address) return "Unknown sender";
  if (looksLikeBounceOrDaemon(address)) return "Mail Delivery System";
  return address;
}

/**
 * Two-letter avatar initials from a display label. Prefers the display name
 * when present, otherwise derives from the local part of the address.
 */
export function senderInitials(
  fromName?: string | null,
  fromEmail?: string,
): string {
  const source = (fromName?.trim() || fromEmail?.trim() || "")
    .split("@")[0]
    .replace(/[._+-]+/g, " ")
    .trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

/**
 * Split a comma-separated `To`/`Cc`/`From` string into individual recipient
 * entries, preserving the original display text for each part.
 *
 * Handles `"Name" <email>` / `Name <email>` / `email` forms. Does not attempt
 * to parse commas inside quoted display names (rare in practice for this
 * app's stored sent/draft addresses).
 */
export function splitRecipients(
  s: string | undefined | null,
): Array<{ name?: string; email?: string; raw: string }> {
  if (!s) return [];
  const out: Array<{ name?: string; email?: string; raw: string }> = [];
  for (const part of s.split(",")) {
    const raw = part.trim();
    if (!raw) continue;
    const m = raw.match(/^(.*?)\s*<([^>]+@[^>]+)>\s*$/);
    if (m) {
      const name = m[1]!.trim().replace(/^["']|["']$/g, "");
      out.push({ name: name || undefined, email: m[2], raw });
      continue;
    }
    const emailMatch = raw.match(/([^\s]+@[^\s]+)/);
    out.push({ name: undefined, email: emailMatch?.[1], raw });
  }
  return out;
}
