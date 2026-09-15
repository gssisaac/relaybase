import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Broadcast } from "../../db/types";
import { findAudienceGroup } from "../audience-groups/group";
import { audienceActiveCountForBroadcast } from "../audience-groups/resolver";

export function findBroadcast(id: string): Broadcast | undefined {
  return store.read().broadcasts.find((b) => b.id === id && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

function getTemplateHtml(templateId: string | null | undefined): string | null {
  if (!templateId) return null;
  return store.read().templates.find((t) => t.id === templateId)?.htmlSource ?? null;
}

export function getBroadcastTemplateHtml(templateId: string | null | undefined): string | null {
  return getTemplateHtml(templateId);
}

export function serializeBroadcast(row: Broadcast) {
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    audienceGroupId: row.audienceGroupId || null,
    audienceGroupName: group?.name ?? null,
    audienceGroupDomain: group?.domain ?? null,
    domain: row.domain || group?.domain || null,
    audienceContactCount: group?.contacts.length ?? null,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    defaultTemplateId: row.defaultTemplateId ?? null,
    listStatus: row.listStatus,
    subject: row.subject,
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown,
    templateId: row.templateId ?? null,
    status: row.status,
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    startedAt: row.startedAt ?? row.sentAt ?? null,
    finishedAt: row.finishedAt ?? null,
    stats: row.stats,
    audienceActiveCount: audienceActiveCountForBroadcast(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
