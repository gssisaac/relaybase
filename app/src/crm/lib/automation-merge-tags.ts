import type { PreviewRecipient } from "@/crm/lib/broadcast-merge-tags";
import {
  applyBroadcastMergeTags,
  type ApplyBroadcastMergeTagsOptions,
} from "@/crm/lib/broadcast-merge-tags";

const SAMPLE_TRIGGER_PAYLOAD: Record<string, string> = {
  verifyUrl: "https://relaybase.xyz/verify?token=preview",
  message: "Sample contact form message for preview.",
  subject: "Question about pricing",
};

function applyTriggerPreviewTags(text: string): string {
  return text.replace(/\{\{trigger\.([a-zA-Z0-9_.-]+)\}\}/g, (_m, key: string) => {
    return SAMPLE_TRIGGER_PAYLOAD[key] ?? `[${key}]`;
  });
}

export function applyAutomationPreviewMergeTags(
  text: string,
  recipient: PreviewRecipient,
  options?: ApplyBroadcastMergeTagsOptions,
): string {
  const withContact = applyBroadcastMergeTags(text, recipient, options);
  return applyTriggerPreviewTags(withContact);
}
