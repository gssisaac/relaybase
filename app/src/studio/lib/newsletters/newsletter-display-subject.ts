/** Primary label for a newsletter everywhere in Studio UI. */
export function newsletterDisplaySubject(
  subject: string | null | undefined,
  fallback = "(No subject)",
): string {
  const trimmed = subject?.trim();
  return trimmed || fallback;
}
