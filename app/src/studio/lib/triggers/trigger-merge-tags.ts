import type { PreviewRecipient } from "@/studio/lib/newsletters/newsletter-merge-tags";
import {
  applyNewsletterMergeTags,
  BROADCAST_MERGE_TAGS,
  type ApplyBroadcastMergeTagsOptions,
} from "@/studio/lib/newsletters/newsletter-merge-tags";
import type { TriggerSource } from "@/lib/studio/api";

export type ComposeMergeTag = {
  id: string;
  token: string;
  label: string;
  description?: string;
};

export type ComposeMergeTagSection = {
  title: string;
  tags: ComposeMergeTag[];
};

const WEBHOOK_STANDARD_TAGS: ComposeMergeTag[] = [
  {
    id: "trigger-verify-url",
    token: "{{trigger.verifyUrl}}",
    label: "Action URL",
    description: "Link for verification, password reset, or action button.",
  },
  {
    id: "trigger-code",
    token: "{{trigger.code}}",
    label: "Code / Token",
    description: "One-time passcode, PIN, or security token.",
  },
  {
    id: "trigger-expires",
    token: "{{trigger.expiresInMinutes}}",
    label: "Expires in (minutes)",
  },
  {
    id: "trigger-order-id",
    token: "{{trigger.orderId}}",
    label: "Order / Ref ID",
  },
  {
    id: "trigger-amount",
    token: "{{trigger.amount}}",
    label: "Amount / Price",
  },
  {
    id: "trigger-message",
    token: "{{trigger.message}}",
    label: "Custom message",
  },
];

function tagFromPayloadPath(path: string): ComposeMergeTag {
  const normalized = path.trim();
  return {
    id: `trigger-field-${normalized.replace(/[^a-zA-Z0-9]+/g, "-")}`,
    token: `{{trigger.${normalized}}}`,
    label: normalized,
    description: "Field from the trigger payload.",
  };
}

function dedupeTags(tags: ComposeMergeTag[]): ComposeMergeTag[] {
  const seen = new Set<string>();
  const out: ComposeMergeTag[] = [];
  for (const tag of tags) {
    if (seen.has(tag.token)) continue;
    seen.add(tag.token);
    out.push(tag);
  }
  return out;
}

/** Suggested `{{trigger.*}}` tags for the automation's trigger configuration. */
export function triggerMergeTagsForAutomation(source: TriggerSource): ComposeMergeTag[] {
  const extra = (source.type === "http_webhook" && source.requiredFields ? source.requiredFields : []).map(tagFromPayloadPath);
  return dedupeTags([...WEBHOOK_STANDARD_TAGS, ...extra]);
}

export function composeMergeTagSectionsForTrigger(
  source: TriggerSource,
): ComposeMergeTagSection[] {
  const contactTags: ComposeMergeTag[] = BROADCAST_MERGE_TAGS.map((t) => ({
    id: t.id,
    token: t.token,
    label: t.label,
    description: t.description,
  }));
  const triggerTags = triggerMergeTagsForAutomation(source);
  const sections: ComposeMergeTagSection[] = [{ title: "Recipient", tags: contactTags }];
  if (triggerTags.length) {
    sections.push({ title: "Trigger payload", tags: triggerTags });
  }
  return sections;
}

const SAMPLE_TRIGGER_PAYLOAD: Record<string, string> = {
  verifyUrl: "https://relaybase.xyz/verify?token=preview",
  signInUrl: "https://relaybase.xyz/sign-in?token=preview",
  magicLinkUrl: "https://relaybase.xyz/sign-in?token=preview",
  expiresInMinutes: "15",
  deviceSummary: "Chrome on macOS",
  requestedAt: "Sep 15, 2026 · 12:30 PM UTC",
  welcomeUrl: "https://relaybase.xyz/welcome",
  message: "Sample contact form message for preview.",
  subject: "Question about pricing",
  body: "Sample inbound email body for preview.",
  fromEmail: "sender@example.com",
  fromName: "Jordan Lee",
};

function triggerTokenKey(token: string): string {
  return token.replace(/^\{\{trigger\./, "").replace(/\}\}$/, "");
}

export function sampleTriggerPreviewValues(source: TriggerSource): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of triggerMergeTagsForAutomation(source)) {
    const key = triggerTokenKey(tag.token);
    out[key] = SAMPLE_TRIGGER_PAYLOAD[key] ?? `[${key}]`;
  }
  return out;
}

function applyTriggerPreviewTags(
  text: string,
  payload: Record<string, string>,
): string {
  return text.replace(/\{\{trigger\.([a-zA-Z0-9_.-]+)\}\}/g, (_m, key: string) => {
    return payload[key] ?? `[${key}]`;
  });
}

export function applyTriggerPreviewMergeTags(
  text: string,
  recipient: PreviewRecipient,
  options?: ApplyBroadcastMergeTagsOptions & {
    trigger?: TriggerSource;
    triggerPayload?: Record<string, string>;
  },
): string {
  const withContact = applyNewsletterMergeTags(text, recipient, options);
  const payload = {
    ...SAMPLE_TRIGGER_PAYLOAD,
    ...(options?.trigger ? sampleTriggerPreviewValues(options.trigger) : {}),
    ...options?.triggerPayload,
  };
  return applyTriggerPreviewTags(withContact, payload);
}
