import type { Newsletter } from "@db/types";
import { NewsletterEntity } from "@db/entities/newsletter.entities";
import { parseDate, parseDateRequired } from "@lib/db/parse-date";

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function isoRequired(value: Date): string {
  return value.toISOString();
}

export function newsletterFromEntity(row: NewsletterEntity): Newsletter {
  return {
    id: row.id,
    accountLinkId: row.accountLinkId,
    subscriberGroupId: row.subscriberGroupId,
    messageId: row.messageId,
    complianceIdentityId: row.complianceIdentityId,
    slug: row.slug,
    description: row.description,
    domain: row.domain,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
    listStatus: row.listStatus as Newsletter["listStatus"],
    status: row.status as Newsletter["status"],
    scheduledAt: iso(row.scheduledAt),
    startedAt: iso(row.startedAt),
    sentAt: iso(row.sentAt),
    finishedAt: iso(row.finishedAt),
    targetFilter: row.targetFilter as Newsletter["targetFilter"],
    stats: row.stats as Newsletter["stats"],
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
  };
}

export function newsletterToEntity(row: Newsletter): NewsletterEntity {
  const entity = new NewsletterEntity();
  entity.id = row.id;
  entity.accountLinkId = row.accountLinkId;
  entity.subscriberGroupId = row.subscriberGroupId;
  entity.messageId = row.messageId;
  entity.complianceIdentityId = row.complianceIdentityId ?? null;
  entity.slug = row.slug;
  entity.description = row.description ?? null;
  entity.domain = row.domain;
  entity.fromName = row.fromName ?? null;
  entity.fromEmail = row.fromEmail ?? null;
  entity.replyTo = row.replyTo ?? null;
  entity.listStatus = row.listStatus;
  entity.status = row.status;
  entity.scheduledAt = parseDate(row.scheduledAt);
  entity.startedAt = parseDate(row.startedAt);
  entity.sentAt = parseDate(row.sentAt);
  entity.finishedAt = parseDate(row.finishedAt);
  entity.targetFilter = row.targetFilter ?? null;
  entity.stats = { ...row.stats };
  entity.createdAt = parseDateRequired(row.createdAt);
  entity.updatedAt = parseDateRequired(row.updatedAt);
  return entity;
}
