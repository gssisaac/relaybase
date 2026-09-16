import {
  COMPLIANCE_PREVIEW_PLACEHOLDERS,
  resolveComplianceFieldForPreview,
} from "@/studio/lib/compliance-preview-values";
import type { LayoutWireframeVariant } from "@/studio/components/layouts/LayoutWireframe";
import { PLAIN_TEXT_TEMPLATE_ID } from "@/studio/lib/layouts/layout-catalog";
import type { NewsletterMember } from "@/lib/studio/api";

export type BroadcastMergeTagCategory = "contact";

export type BroadcastMergeTag = {
  id: string;
  token: string;
  label: string;
  description: string;
  category: BroadcastMergeTagCategory;
  example: string;
  fallbackHint?: string;
};

export const BROADCAST_MERGE_TAGS: BroadcastMergeTag[] = [
  {
    id: "contact-name",
    token: "{{contact.name}}",
    label: "Contact name",
    description: "Subscriber display name from the subscriber group.",
    category: "contact",
    example: "Alex Kim",
    fallbackHint: "Uses the email local-part when name is empty.",
  },
  {
    id: "contact-email",
    token: "{{contact.email}}",
    label: "Contact email",
    description: "Recipient email address.",
    category: "contact",
    example: "alex@example.com",
  },
];

export const MERGE_TAG_CATEGORIES: { id: BroadcastMergeTagCategory; label: string }[] = [
  { id: "contact", label: "Recipient" },
];

/** Insertable merge tags for subject lines (same as body recipient tags). */
export const SUBJECT_MERGE_TAGS = BROADCAST_MERGE_TAGS;

export type PreviewPersonaId = "sample-named" | "sample-unnamed" | `member:${string}`;

export type PreviewRecipient = {
  email: string;
  name: string | null;
  label: string;
};

const SAMPLE_NAMED: PreviewRecipient = {
  email: "alex@example.com",
  name: "Alex Kim",
  label: "Sample · with name",
};

const SAMPLE_UNNAMED: PreviewRecipient = {
  email: "alex@example.com",
  name: null,
  label: "Sample · no name (fallback)",
};

export function displayNameForRecipient(recipient: {
  email: string;
  name?: string | null;
}): string {
  return (
    recipient.name?.trim() ||
    recipient.email.split("@")[0]?.trim() ||
    recipient.email
  );
}

export type ComplianceMergeValues = {
  organizationName?: string | null;
  postalAddress?: string | null;
  complianceContactEmail?: string | null;
};

export type ApplyBroadcastMergeTagsOptions = {
  unsubscribeUrl?: string;
  compliance?: ComplianceMergeValues;
  /** When true, empty compliance fields show Settings hints (Content preview only). */
  compliancePreviewPlaceholders?: boolean;
  compliancePlaceholderFormat?: "html" | "plain";
};

function resolveComplianceMergeValue(
  value: string | null | undefined,
  placeholderKey: keyof typeof COMPLIANCE_PREVIEW_PLACEHOLDERS,
  options: ApplyBroadcastMergeTagsOptions | undefined,
): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  if (options?.compliancePreviewPlaceholders) {
    return resolveComplianceFieldForPreview(
      null,
      COMPLIANCE_PREVIEW_PLACEHOLDERS[placeholderKey],
      options.compliancePlaceholderFormat ?? "html",
    );
  }
  return "";
}

export function applyNewsletterMergeTags(
  html: string,
  recipient: { email: string; name?: string | null },
  options?: ApplyBroadcastMergeTagsOptions,
): string {
  const displayName = displayNameForRecipient(recipient);
  const unsubscribeUrl = options?.unsubscribeUrl ?? "#";
  const compliance = options?.compliance;
  return html
    .replaceAll("{{contact.name}}", displayName)
    .replaceAll("{{contact.email}}", recipient.email)
    .replaceAll("{{unsubscribe_url}}", unsubscribeUrl)
    .replaceAll(
      "{{organization_name}}",
      resolveComplianceMergeValue(
        compliance?.organizationName,
        "organizationName",
        options,
      ),
    )
    .replaceAll(
      "{{postal_address}}",
      resolveComplianceMergeValue(compliance?.postalAddress, "postalAddress", options),
    )
    .replaceAll(
      "{{compliance_contact_email}}",
      resolveComplianceMergeValue(
        compliance?.complianceContactEmail,
        "complianceContactEmail",
        options,
      ),
    );
}

export function resolvePreviewRecipient(
  personaId: PreviewPersonaId,
  members: NewsletterMember[],
): PreviewRecipient {
  if (personaId === "sample-named") return SAMPLE_NAMED;
  if (personaId === "sample-unnamed") return SAMPLE_UNNAMED;
  if (personaId.startsWith("member:")) {
    const id = personaId.slice("member:".length);
    const member = members.find((m) => m.id === id);
    if (member) {
      const label = member.name?.trim() || member.email;
      return { email: member.email, name: member.name, label };
    }
  }
  return SAMPLE_NAMED;
}

export function previewPersonaOptions(members: NewsletterMember[]): {
  value: PreviewPersonaId;
  label: string;
}[] {
  const base: { value: PreviewPersonaId; label: string }[] = [
    { value: "sample-named", label: SAMPLE_NAMED.label },
    { value: "sample-unnamed", label: SAMPLE_UNNAMED.label },
  ];
  const fromAudience = members.slice(0, 25).map((m) => ({
    value: `member:${m.id}` as PreviewPersonaId,
    label: m.name?.trim() ? `${m.name.trim()} · ${m.email}` : m.email,
  }));
  return [...base, ...fromAudience];
}

export function templateThumbnailVariant(
  templateId: string,
  derivedFromTemplateId?: string | null,
): LayoutWireframeVariant {
  const key = derivedFromTemplateId ?? templateId;
  if (key === PLAIN_TEXT_TEMPLATE_ID) return "plain";
  if (key.includes("dark-obsidian")) return "dark";
  if (key.includes("editorial")) return "editorial";
  if (key.includes("product-launch")) return "launch";
  if (key.includes("warm-sand")) return "warm";
  if (key.includes("curated-digest")) return "digest";
  if (key.includes("receipt-invoice") || key.includes("receipt")) return "receipt";
  if (key.includes("event-ticket") || key.includes("ticket")) return "ticket";
  if (key.includes("founder-letter") || key.includes("letter")) return "letter";
  if (key.includes("spotlight")) return "spotlight";
  if (key.includes("publication-post") || key.includes("post")) return "post";
  if (key.includes("keynote-banner") || key.includes("keynote")) return "keynote";
  if (key.includes("event-invite") || key.includes("invite")) return "invite";
  if (key.includes("header")) return "header";
  if (key.includes("card")) return "card";
  return "minimal";
}
