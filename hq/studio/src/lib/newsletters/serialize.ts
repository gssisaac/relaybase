import { DEV_ACCOUNT_LINK_ID, store } from "../../db/store";
import type { Newsletter } from "../../db/types";
import { findSubscriberGroup } from "../subscriber-groups/group";
import { subscriberActiveCountForNewsletter } from "../subscriber-groups/resolver";
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
  const group = row.subscriberGroupId ? findSubscriberGroup(row.subscriberGroupId) : undefined;
  const message = resolveMessage(data, rowMessageId(row));
  return {
    id: row.id,
    slug: row.slug,
    description: row.description ?? null,
    subscriberGroupId: row.subscriberGroupId || null,
    subscriberGroupName: group?.name ?? null,
    subscriberGroupDomain: group?.domain ?? null,
    domain: row.domain || group?.domain || null,
    subscriberContactCount: group?.contacts.length ?? null,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    complianceIdentityId: row.complianceIdentityId ?? null,
    listStatus: row.listStatus,
    messageId: rowMessageId(row),
    layoutId: message?.layoutId ?? null,
    defaultLayoutId: message?.layoutId ?? null,
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
    subscriberActiveCount: subscriberActiveCountForNewsletter(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
