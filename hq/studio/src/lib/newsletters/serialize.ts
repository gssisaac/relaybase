import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Newsletter } from "../../db/types";
import { findAudienceGroup } from "../audience-groups/group";
import { audienceActiveCountForNewsletter } from "../audience-groups/resolver";
import { getLayoutHtml, getLayoutSchema, resolveMessage, rowMessageId } from "../messages/resolve";

export function findNewsletter(id: string): Newsletter | undefined {
  return store.read().newsletters.find((b) => b.id === id && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function getNewsletterLayoutHtml(layoutId: string | null | undefined): string | null {
  return getLayoutHtml(store.read(), layoutId);
}

export function getNewsletterLayoutSchema(layoutId: string | null | undefined) {
  return getLayoutSchema(store.read(), layoutId);
}

export function serializeNewsletter(row: Newsletter) {
  const data = store.read();
  const group = row.audienceGroupId ? findAudienceGroup(row.audienceGroupId) : undefined;
  const message = resolveMessage(data, rowMessageId(row));
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
    complianceIdentityId: row.complianceIdentityId ?? null,
    listStatus: row.listStatus,
    messageId: rowMessageId(row),
    layoutId: message?.layoutId ?? null,
    subject: message?.subject ?? "",
    previewText: message?.previewText ?? null,
    bodyMarkdown: message?.bodyMarkdown ?? "",
    templateVariables: message?.templateVariables ?? {},
    status: row.status,
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    startedAt: row.startedAt ?? row.sentAt ?? null,
    finishedAt: row.finishedAt ?? null,
    stats: row.stats,
    audienceActiveCount: audienceActiveCountForNewsletter(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
