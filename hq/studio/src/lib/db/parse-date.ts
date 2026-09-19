/** Parse ISO strings from the JSON store into `Date` for PostgreSQL. */
export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateRequired(iso: string | undefined, fallback = new Date()): Date {
  return parseDate(iso) ?? fallback;
}
