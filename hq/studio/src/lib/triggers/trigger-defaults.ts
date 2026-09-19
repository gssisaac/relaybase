import { newToken } from "@lib/shared/ids";
import type { TriggerPurpose, TriggerSource } from "@db/types";

export function defaultTriggerForPurpose(purpose?: TriggerPurpose): TriggerSource {
  if (purpose === "conversational") {
    return defaultMailboxInboundTrigger();
  }
  return defaultHttpWebhookTrigger();
}

export function defaultHttpWebhookTrigger(): TriggerSource {
  return {
    type: "http_webhook",
    secret: newToken(),
    emailPath: "email",
    namePath: "name",
    requiredFields: [],
  };
}

export function defaultMailboxInboundTrigger(domain = "", localPart = "support"): TriggerSource {
  return {
    type: "mailbox_inbound",
    domain,
    localPart,
    replyToSender: true,
    match: null,
  };
}
