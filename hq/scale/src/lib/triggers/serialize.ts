import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Trigger, TriggerSource } from "../../db/types";
import { findAudienceGroup } from "../audience-groups/group";
import { getLayoutHtml, getLayoutSchema, resolveMessage, triggerSource } from "../messages/resolve";

export function findTrigger(id: string): Trigger | undefined {
  return store.read().triggers.find((a) => a.id === id && a.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function getTriggerLayoutHtml(layoutId: string | null | undefined): string | null {
  return getLayoutHtml(store.read(), layoutId);
}

export function getTriggerLayoutSchema(layoutId: string | null | undefined) {
  return getLayoutSchema(store.read(), layoutId);
}

function maskTriggerSecret(source: TriggerSource): TriggerSource {
  if (source.type !== "http_webhook") return source;
  return {
    ...source,
    secret: source.secret ? "••••••••" : "",
  };
}

export function serializeTrigger(row: Trigger, options?: { revealTriggerSecret?: boolean }) {
  const data = store.read();
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  const source = triggerSource(row);
  const sourceOut =
    options?.revealTriggerSecret || source.type !== "http_webhook"
      ? source
      : maskTriggerSecret(source);
  const message = resolveMessage(data, row.templateId);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    domain: row.domain,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    complianceIdentityId: row.complianceIdentityId ?? null,
    purpose: row.purpose,
    listStatus: row.listStatus,
    status: row.status,
    source: sourceOut,
    audienceGroupId: row.audienceGroupId ?? null,
    audienceGroupName: group?.name ?? null,
    cooldownSeconds: row.cooldownSeconds,
    applyMarketingSuppression: row.applyMarketingSuppression,
    messageTemplateId: row.templateId,
    layoutId: message?.layoutId ?? null,
    subject: message?.subject ?? "",
    previewText: message?.previewText ?? null,
    bodyMarkdown: message?.bodyMarkdown ?? "",
    templateVariables: message?.templateVariables ?? {},
    stats: row.stats,
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    lastSentAt: row.lastSentAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeTriggerEvent(row: import("../../db/types").TriggerEvent) {
  return {
    id: row.id,
    triggerId: row.triggerId,
    triggerType: row.triggerType,
    idempotencyKey: row.idempotencyKey,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName ?? null,
    payload: row.payload,
    status: row.status,
    skipReason: row.skipReason ?? null,
    occurredAt: row.occurredAt,
  };
}

export function serializeTriggerSend(row: import("../../db/types").TriggerSend) {
  return {
    id: row.id,
    triggerId: row.triggerId,
    triggerEventId: row.triggerEventId,
    audienceMemberId: row.audienceMemberId ?? null,
    email: row.email,
    name: row.name ?? null,
    status: row.status,
    errorMessage: row.errorMessage ?? null,
    bounceReason: row.bounceReason ?? null,
    sentAt: row.sentAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
    openedAt: row.openedAt ?? null,
    clickedAt: row.clickedAt ?? null,
    unsubscribedAt: row.unsubscribedAt ?? null,
    openCount: row.openCount,
    clickCount: row.clickCount,
    createdAt: row.createdAt,
  };
}
