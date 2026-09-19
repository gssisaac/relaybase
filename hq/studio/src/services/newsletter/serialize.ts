import type { Newsletter } from "@db/types";
import { findSubscriberGroup } from "@services/subscriber/group";
import { subscriberActiveCountForNewsletter } from "@services/subscriber/resolver";
import { getLayoutHtml, getLayoutSchema, resolveMessage, rowMessageId } from "@services/message/resolve";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export function findNewsletter(id: string): Newsletter | undefined {
  return readStudioDocument().newsletters.find((b) => b.id === id && b.accountLinkId === DEV_ACCOUNT_LINK_ID);
}

export function getNewsletterLayoutHtml(layoutId: string | null | undefined): string | null {
  return getLayoutHtml(readStudioDocument(), layoutId);
}

export function getNewsletterLayoutSchema(layoutId: string | null | undefined) {
  return getLayoutSchema(readStudioDocument(), layoutId);
}

export function serializeNewsletter(row: Newsletter) {
  const data = readStudioDocument();
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
