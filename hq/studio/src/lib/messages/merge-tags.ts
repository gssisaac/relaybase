export function applyMergeTagValues(text: string, mergeTags: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(mergeTags)) {
    const k = key.trim();
    if (!k) continue;
    out = out.replaceAll(`{{${k}}}`, value);
  }
  return out;
}

export function recipientDisplayName(mergeTags: Record<string, string>, email: string): string {
  const named = mergeTags["contact.name"]?.trim();
  if (named) return named;
  return email.split("@")[0]?.trim() || email;
}
