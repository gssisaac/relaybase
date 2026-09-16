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

const INTERNAL_VERIFY_EMAIL_TAGS: ComposeMergeTag[] = [
  {
    id: "trigger-verify-url",
    token: "{{trigger.verifyUrl}}",
    label: "Verification link",
    description: "URL the recipient opens to verify email.",
  },
  {
    id: "trigger-sign-in-url",
    token: "{{trigger.signInUrl}}",
    label: "Sign-in link",
    description: "Magic link or one-time sign-in URL.",
  },
  {
    id: "trigger-expires",
    token: "{{trigger.expiresInMinutes}}",
    label: "Link expiry (minutes)",
  },
  {
    id: "trigger-device",
    token: "{{trigger.deviceSummary}}",
    label: "Device summary",
  },
  {
    id: "trigger-requested-at",
    token: "{{trigger.requestedAt}}",
    label: "Requested at",
  },
];

const INTERNAL_CREATED_TAGS: ComposeMergeTag[] = [
  {
    id: "trigger-welcome-url",
    token: "{{trigger.welcomeUrl}}",
    label: "Welcome link",
  },
];

const FORM_SUBMIT_TAGS: ComposeMergeTag[] = [
  {
    id: "trigger-message",
    token: "{{trigger.message}}",
    label: "Message",
  },
  {
    id: "trigger-subject",
    token: "{{trigger.subject}}",
    label: "Subject (form field)",
  },
];

const MAILBOX_INBOUND_TAGS: ComposeMergeTag[] = [
  {
    id: "trigger-inbound-subject",
    token: "{{trigger.subject}}",
    label: "Inbound subject",
  },
  {
    id: "trigger-inbound-body",
    token: "{{trigger.body}}",
    label: "Inbound body",
  },
  {
    id: "trigger-inbound-from-email",
    token: "{{trigger.fromEmail}}",
    label: "Sender email",
  },
  {
    id: "trigger-inbound-from-name",
    token: "{{trigger.fromName}}",
    label: "Sender name",
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
  switch (source.type) {
    case "internal_event":
      if (source.event === "account.verify_email") {
        return [...INTERNAL_VERIFY_EMAIL_TAGS];
      }
      return [...INTERNAL_CREATED_TAGS];
    case "form_submit": {
      const extra = (source.requiredFields ?? []).map(tagFromPayloadPath);
      return dedupeTags([...FORM_SUBMIT_TAGS, ...extra]);
    }
    case "http_webhook": {
      const extra = (source.requiredFields ?? []).map(tagFromPayloadPath);
      return dedupeTags(extra);
    }
    case "mailbox_inbound":
      return [...MAILBOX_INBOUND_TAGS];
    default:
      return [];
  }
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
