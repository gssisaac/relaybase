import { createHash } from "node:crypto";

import type {
  Trigger,
  TriggerSource,
  TriggerEvent,
  TriggerEventSkipReason,
} from "@db/types";
import { newId } from "@lib/shared/ids";
import { triggerSource } from "@lib/messages/resolve";
import { isWithinTriggerCooldown } from "@lib/triggers/cooldown";
import { dispatchTriggerSend } from "@lib/triggers/dispatch";
import { payloadHasRequiredFields, readPayloadString } from "@lib/triggers/payload-path";
import { isEmailSuppressedForTrigger } from "@lib/triggers/suppression";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export type FireAutomationInput = {
  automation: Trigger;
  triggerType: TriggerSource["type"];
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
};

export type FireAutomationResult = {
  triggerEventId: string;
  triggerSendId: string | null;
  status: TriggerEvent["status"];
  skipReason: TriggerEventSkipReason | null;
  sendError?: string;
};

function defaultIdempotencyKey(triggerId: string, payload: Record<string, unknown>): string {
  const hash = createHash("sha256")
    .update(triggerId)
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  return `auto_${hash}`;
}

function extractRecipientFromTrigger(
  automation: Trigger,
  payload: Record<string, unknown>,
  overrides: { email?: string | null; name?: string | null },
): { email: string | null; name: string | null } {
  if (overrides.email?.trim()) {
    return {
      email: overrides.email.trim().toLowerCase(),
      name: overrides.name?.trim() || null,
    };
  }

  const trigger = triggerSource(automation);
  if (trigger.type === "mailbox_inbound" && trigger.replyToSender) {
    const from =
      readPayloadString(payload, "fromEmail") ??
      readPayloadString(payload, "email") ??
      readPayloadString(payload, "from");
    const name =
      readPayloadString(payload, "fromName") ?? readPayloadString(payload, "name");
    return { email: from?.toLowerCase() ?? null, name };
  }

  const emailPath =
    trigger.type === "http_webhook"
      ? trigger.emailPath
      : "email";
  const namePath =
    trigger.type === "http_webhook"
      ? (trigger.namePath ?? "name")
      : "name";

  const email = readPayloadString(payload, emailPath)?.toLowerCase() ?? null;
  const name = readPayloadString(payload, namePath);
  return { email, name };
}

function requiredFieldsForTrigger(trigger: TriggerSource): string[] | undefined {
  if (trigger.type === "http_webhook") {
    return trigger.requiredFields;
  }
  return undefined;
}

export async function fireTrigger(input: FireAutomationInput): Promise<FireAutomationResult> {
  const { automation } = input;
  const now = new Date().toISOString();
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    defaultIdempotencyKey(automation.id, input.payload);

  const existing = readStudioDocument()
    .triggerEvents.find(
      (e) => e.accountLinkId === DEV_ACCOUNT_LINK_ID && e.idempotencyKey === idempotencyKey,
    );
  if (existing) {
    const send = readStudioDocument()
      .triggerSends.find((s) => s.triggerEventId === existing.id);
    return {
      triggerEventId: existing.id,
      triggerSendId: send?.id ?? null,
      status: existing.status,
      skipReason: existing.skipReason ?? "duplicate",
    };
  }

  const recipient = extractRecipientFromTrigger(automation, input.payload, {
    email: input.recipientEmail,
    name: input.recipientName,
  });

  let skipReason: TriggerEventSkipReason | null = null;
  let eventStatus: TriggerEvent["status"] = "received";

  if (automation.status === "draft") {
    skipReason = "draft";
    eventStatus = "skipped";
  } else if (automation.status === "paused") {
    skipReason = "paused";
    eventStatus = "skipped";
  } else if (!recipient.email?.includes("@")) {
    skipReason = "invalid_payload";
    eventStatus = "skipped";
  } else if (!payloadHasRequiredFields(input.payload, requiredFieldsForTrigger(triggerSource(automation)))) {
    skipReason = "invalid_payload";
    eventStatus = "skipped";
  } else if (isEmailSuppressedForTrigger(automation, recipient.email)) {
    skipReason = "suppressed";
    eventStatus = "skipped";
  } else if (isWithinTriggerCooldown(automation.id, recipient.email, automation.cooldownSeconds)) {
    skipReason = "cooldown";
    eventStatus = "skipped";
  }

  const triggerEventId = newId("triggerevent");
  let triggerSendId: string | null = null;
  let sendError: string | undefined;

  mutateStudioDocument((draft) => {
    const aIdx = draft.triggers.findIndex((a) => a.id === automation.id);
    if (aIdx >= 0) {
      const stats = draft.triggers[aIdx]!.stats;
      draft.triggers[aIdx] = {
        ...draft.triggers[aIdx]!,
        stats: {
          ...stats,
          triggered: stats.triggered + 1,
          matched: stats.matched + 1,
          deduped: skipReason === "cooldown" ? stats.deduped + 1 : stats.deduped,
          skipped: skipReason ? stats.skipped + 1 : stats.skipped,
        },
        lastTriggeredAt: now,
        updatedAt: now,
      };
    }

    draft.triggerEvents.push({
      id: triggerEventId,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      triggerId: automation.id,
      triggerType: input.triggerType,
      idempotencyKey,
      recipientEmail: recipient.email ?? "",
      recipientName: recipient.name,
      payload: input.payload,
      status: eventStatus,
      skipReason,
      occurredAt: now,
    });
  });

  if (skipReason) {
    return { triggerEventId, triggerSendId: null, status: eventStatus, skipReason };
  }

  triggerSendId = newId("autosend");
  mutateStudioDocument((draft) => {
    draft.triggerSends.push({
      id: triggerSendId!,
      triggerId: automation.id,
      triggerEventId,
      subscriberMemberId: null,
      email: recipient.email!,
      name: recipient.name,
      status: "queued",
      errorMessage: null,
      bounceReason: null,
      sentAt: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      unsubscribedAt: null,
      openCount: 0,
      clickCount: 0,
      createdAt: now,
    });

    const teIdx = draft.triggerEvents.findIndex((e) => e.id === triggerEventId);
    if (teIdx >= 0) {
      draft.triggerEvents[teIdx] = {
        ...draft.triggerEvents[teIdx]!,
        status: "queued",
      };
    }
  });

  const freshAutomation = readStudioDocument().triggers.find((a) => a.id === automation.id)!;
  const sendRow = readStudioDocument().triggerSends.find((s) => s.id === triggerSendId)!;
  const dispatchResult = await dispatchTriggerSend(freshAutomation, sendRow, input.payload);

  if (!dispatchResult.ok) {
    sendError = dispatchResult.error;
    mutateStudioDocument((draft) => {
      const teIdx = draft.triggerEvents.findIndex((e) => e.id === triggerEventId);
      if (teIdx >= 0) {
        draft.triggerEvents[teIdx] = {
          ...draft.triggerEvents[teIdx]!,
          status: "failed",
          skipReason: "send_failed",
        };
      }
    });
    return {
      triggerEventId,
      triggerSendId,
      status: "failed",
      skipReason: "send_failed",
      sendError,
    };
  }

  mutateStudioDocument((draft) => {
    const teIdx = draft.triggerEvents.findIndex((e) => e.id === triggerEventId);
    if (teIdx >= 0) {
      draft.triggerEvents[teIdx] = {
        ...draft.triggerEvents[teIdx]!,
        status: "sent",
      };
    }
  });

  return {
    triggerEventId,
    triggerSendId,
    status: "sent",
    skipReason: null,
  };
}

/** Record an inbound event with no matching automation (audit only). */
export function recordUnmatchedTriggerEvent(input: {
  triggerType: TriggerSource["type"];
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  recipientEmail?: string;
}): string {
  const id = newId("triggerevent");
  const now = new Date().toISOString();
  mutateStudioDocument((draft) => {
    draft.triggerEvents.push({
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      triggerId: null,
      triggerType: input.triggerType,
      idempotencyKey: input.idempotencyKey ?? newId("idem"),
      recipientEmail: input.recipientEmail ?? "",
      recipientName: null,
      payload: input.payload,
      status: "skipped",
      skipReason: "no_match",
      occurredAt: now,
    });
  });
  return id;
}
