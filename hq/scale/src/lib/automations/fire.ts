import { createHash } from "node:crypto";

import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type {
  Automation,
  AutomationTrigger,
  TriggerEvent,
  TriggerEventSkipReason,
} from "../../db/types";
import { newId } from "../shared/ids";
import { isWithinAutomationCooldown } from "./cooldown";
import { dispatchAutomationSend } from "./dispatch";
import { payloadHasRequiredFields, readPayloadString } from "./payload-path";
import { isEmailSuppressedForAutomation } from "./suppression";

export type FireAutomationInput = {
  automation: Automation;
  triggerType: AutomationTrigger["type"];
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
};

export type FireAutomationResult = {
  triggerEventId: string;
  automationSendId: string | null;
  status: TriggerEvent["status"];
  skipReason: TriggerEventSkipReason | null;
  sendError?: string;
};

function defaultIdempotencyKey(automationId: string, payload: Record<string, unknown>): string {
  const hash = createHash("sha256")
    .update(automationId)
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
  return `auto_${hash}`;
}

function extractRecipientFromTrigger(
  automation: Automation,
  payload: Record<string, unknown>,
  overrides: { email?: string | null; name?: string | null },
): { email: string | null; name: string | null } {
  if (overrides.email?.trim()) {
    return {
      email: overrides.email.trim().toLowerCase(),
      name: overrides.name?.trim() || null,
    };
  }

  const trigger = automation.trigger;
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
    trigger.type === "http_webhook" || trigger.type === "form_submit"
      ? trigger.emailPath
      : "email";
  const namePath =
    trigger.type === "http_webhook" || trigger.type === "form_submit"
      ? (trigger.namePath ?? "name")
      : "name";

  const email = readPayloadString(payload, emailPath)?.toLowerCase() ?? null;
  const name = readPayloadString(payload, namePath);
  return { email, name };
}

function requiredFieldsForTrigger(trigger: AutomationTrigger): string[] | undefined {
  if (trigger.type === "http_webhook" || trigger.type === "form_submit") {
    return trigger.requiredFields;
  }
  return undefined;
}

export async function fireAutomation(input: FireAutomationInput): Promise<FireAutomationResult> {
  const { automation } = input;
  const now = new Date().toISOString();
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    defaultIdempotencyKey(automation.id, input.payload);

  const existing = store
    .read()
    .triggerEvents.find(
      (e) => e.accountLinkId === DEV_ACCOUNT_LINK_ID && e.idempotencyKey === idempotencyKey,
    );
  if (existing) {
    const send = store
      .read()
      .automationSends.find((s) => s.triggerEventId === existing.id);
    return {
      triggerEventId: existing.id,
      automationSendId: send?.id ?? null,
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
  } else if (!payloadHasRequiredFields(input.payload, requiredFieldsForTrigger(automation.trigger))) {
    skipReason = "invalid_payload";
    eventStatus = "skipped";
  } else if (isEmailSuppressedForAutomation(automation, recipient.email)) {
    skipReason = "suppressed";
    eventStatus = "skipped";
  } else if (isWithinAutomationCooldown(automation.id, recipient.email, automation.cooldownSeconds)) {
    skipReason = "cooldown";
    eventStatus = "skipped";
  }

  const triggerEventId = newId("triggerevent");
  let automationSendId: string | null = null;
  let sendError: string | undefined;

  store.update((draft) => {
    const aIdx = draft.automations.findIndex((a) => a.id === automation.id);
    if (aIdx >= 0) {
      const stats = draft.automations[aIdx]!.stats;
      draft.automations[aIdx] = {
        ...draft.automations[aIdx]!,
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
      automationId: automation.id,
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
    return { triggerEventId, automationSendId: null, status: eventStatus, skipReason };
  }

  automationSendId = newId("autosend");
  store.update((draft) => {
    draft.automationSends.push({
      id: automationSendId!,
      automationId: automation.id,
      triggerEventId,
      audienceMemberId: null,
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

  const freshAutomation = store.read().automations.find((a) => a.id === automation.id)!;
  const sendRow = store.read().automationSends.find((s) => s.id === automationSendId)!;
  const dispatchResult = await dispatchAutomationSend(freshAutomation, sendRow, input.payload);

  if (!dispatchResult.ok) {
    sendError = dispatchResult.error;
    store.update((draft) => {
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
      automationSendId,
      status: "failed",
      skipReason: "send_failed",
      sendError,
    };
  }

  store.update((draft) => {
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
    automationSendId,
    status: "sent",
    skipReason: null,
  };
}

/** Record an inbound event with no matching automation (audit only). */
export function recordUnmatchedTriggerEvent(input: {
  triggerType: AutomationTrigger["type"];
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  recipientEmail?: string;
}): string {
  const id = newId("triggerevent");
  const now = new Date().toISOString();
  store.update((draft) => {
    draft.triggerEvents.push({
      id,
      accountLinkId: DEV_ACCOUNT_LINK_ID,
      automationId: null,
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
