/** Local-part of an email (`alice` from `alice@example.com`). */
export function emailLocalPart(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email.trim();
}

/** Display name: explicit name, else email local-part. */
export function audienceContactDisplayName(
  email: string,
  name?: string | null,
): string {
  const trimmed = name?.trim();
  return trimmed || emailLocalPart(email);
}
