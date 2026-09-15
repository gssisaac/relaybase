export const COMPLIANCE_PREVIEW_PLACEHOLDERS = {
  organizationName: "Your organization name",
  postalAddress: "Your postal address",
  complianceContactEmail: "Compliance contact email",
} as const;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Preview-only: show bracketed hints when Settings → Compliance fields are empty. */
export function resolveComplianceFieldForPreview(
  value: string | null | undefined,
  placeholder: string,
  format: "html" | "plain",
): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  const label = `[${placeholder} — set in Compliance sender]`;
  if (format === "plain") return label;
  return `<span data-compliance-placeholder="true" style="color:#94a3b8;font-style:italic;">${escapeHtml(label)}</span>`;
}
