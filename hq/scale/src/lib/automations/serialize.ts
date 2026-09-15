import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Automation, AutomationTrigger } from "../../db/types";
import { findAudienceGroup } from "../audience-groups/group";

export function findAutomation(id: string): Automation | undefined {
  return store.read().automations.find((a) => a.id === id && a.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function getTemplateHtml(templateId: string | null | undefined): string | null {
  if (!templateId) return null;
  return store.read().templates.find((t) => t.id === templateId)?.htmlSource ?? null;
}

export function getAutomationTemplateHtml(templateId: string | null | undefined): string | null {
  return getTemplateHtml(templateId);
}

export function getAutomationTemplateSchema(templateId: string | null | undefined) {
  if (!templateId) return null;
  return store.read().templates.find((t) => t.id === templateId)?.variablesSchema ?? null;
}

function maskTriggerSecret(trigger: AutomationTrigger): AutomationTrigger {
  if (trigger.type !== "http_webhook") return trigger;
  return {
    ...trigger,
    secret: trigger.secret ? "••••••••" : "",
  };
}

export function serializeAutomation(row: Automation, options?: { revealTriggerSecret?: boolean }) {
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  const trigger =
    options?.revealTriggerSecret || row.trigger.type !== "http_webhook"
      ? row.trigger
      : maskTriggerSecret(row.trigger);

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
    trigger,
    audienceGroupId: row.audienceGroupId ?? null,
    audienceGroupName: group?.name ?? null,
    cooldownSeconds: row.cooldownSeconds,
    applyMarketingSuppression: row.applyMarketingSuppression,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    templateId: row.templateId ?? null,
    templateVariables: row.templateVariables ?? {},
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
    automationId: row.automationId,
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

export function serializeAutomationSend(row: import("../../db/types").AutomationSend) {
  return {
    id: row.id,
    automationId: row.automationId,
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
