/**
 * One-shot import: local JSON/YAML dev store → PostgreSQL (TypeORM entities).
 *
 * Usage: DATABASE_URL=postgres://... TYPEORM_SYNC=1 pnpm run orm:migrate:json
 */
import "reflect-metadata";

import type { EntityTarget, ObjectLiteral, Repository } from "typeorm";

import { authStore } from "../auth-store";
import { store } from "../store";
import type { StudioDataStore } from "../types";
import { createStudioDataSource } from "./data-source";
import {
  AccountLinkEntity,
  AccountSuppressionEntity,
  ActivityEntity,
  ComplianceIdentityEntity,
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
  LayoutEntity,
  MessageAssetEntity,
  MessageEntity,
  NewsletterAssetEntity,
  NewsletterEntity,
  PipelineCardEntity,
  RecipientEntity,
  ScheduledJobEntity,
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
  TemplateEntity,
  TrackingEventEntity,
  TriggerAssetEntity,
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
} from "./entities/index";
import { parseDate, parseDateRequired } from "./parse-date";

const CHUNK = 400;

async function saveChunked<T extends ObjectLiteral>(
  repo: Repository<T>,
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await repo.save(rows.slice(i, i + CHUNK));
  }
}

async function truncateAll(queryRunner: { query: (sql: string) => Promise<unknown> }) {
  const tables = [
    "hq_password_reset_tokens",
    "hq_refresh_tokens",
    "hq_auth_users",
    "trigger_tracking_events",
    "trigger_sends",
    "trigger_events",
    "tracking_events",
    "recipients",
    "newsletter_assets",
    "trigger_assets",
    "message_assets",
    "newsletters",
    "triggers",
    "subscriber_sync_runs",
    "subscriber_members",
    "subscriber_groups",
    "account_suppressions",
    "scheduled_jobs",
    "pipeline_cards",
    "activities",
    "messages",
    "templates",
    "compliance_identities",
    "layouts",
    "account_links",
  ];
  await queryRunner.query(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

function mapStoreToEntities(data: StudioDataStore) {
  const account = data.account;
  const accountRow = new AccountLinkEntity();
  accountRow.id = account.id;
  accountRow.workerUrl = account.workerUrl;
  accountRow.domain = account.domain;
  accountRow.sendApiKey = account.sendApiKey ?? null;
  accountRow.organizationName = account.compliance.organizationName;
  accountRow.postalAddress = account.compliance.postalAddress;
  accountRow.contactEmail = account.compliance.contactEmail;
  accountRow.complianceUpdatedAt = parseDate(account.compliance.updatedAt);
  accountRow.defaultComplianceIdentityId = account.defaultComplianceIdentityId;
  accountRow.createdAt = parseDateRequired(account.createdAt);
  accountRow.updatedAt = parseDate(account.compliance.updatedAt) ?? accountRow.createdAt;

  const complianceRows = data.complianceIdentities.map((row) => {
    const entity = new ComplianceIdentityEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.name = row.name;
    entity.organizationName = row.organizationName;
    entity.postalAddress = row.postalAddress;
    entity.contactEmail = row.contactEmail;
    entity.createdAt = parseDateRequired(row.createdAt);
    entity.updatedAt = parseDateRequired(row.updatedAt);
    return entity;
  });

  const layoutRows = data.layouts.map((row) => {
    const entity = new LayoutEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.name = row.name;
    entity.htmlSource = row.htmlSource;
    entity.variablesSchema = (row.variablesSchema as Record<string, unknown> | null | undefined) ?? null;
    entity.isBuiltin = row.isBuiltin;
    entity.derivedFromLayoutId = row.derivedFromLayoutId ?? null;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const templateRows = data.templates.map((row) => {
    const entity = new TemplateEntity();
    entity.id = row.id;
    entity.name = row.name;
    entity.description = row.description ?? null;
    entity.subject = row.subject;
    entity.previewText = row.previewText ?? null;
    entity.bodyMarkdown = row.bodyMarkdown;
    entity.layoutId = row.layoutId;
    entity.templateVariables = row.templateVariables ?? {};
    entity.category = row.category ?? null;
    entity.isBuiltin = row.isBuiltin;
    entity.createdAt = parseDateRequired(row.createdAt);
    entity.updatedAt = parseDateRequired(row.updatedAt);
    return entity;
  });

  const messageRows = data.messages.map((row) => {
    const entity = new MessageEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.name = row.name;
    entity.subject = row.subject;
    entity.previewText = row.previewText ?? null;
    entity.bodyMarkdown = row.bodyMarkdown;
    entity.layoutId = row.layoutId ?? null;
    entity.templateVariables = row.templateVariables ?? {};
    entity.forkedFromTemplateId = row.forkedFromTemplateId ?? null;
    entity.createdAt = parseDateRequired(row.createdAt);
    entity.updatedAt = parseDateRequired(row.updatedAt);
    return entity;
  });

  const subscriberGroupRows: SubscriberGroupEntity[] = [];
  const subscriberMemberRows: SubscriberMemberEntity[] = [];
  const subscriberSyncRows: SubscriberSyncRunEntity[] = [];

  for (const group of data.subscriberGroups) {
    const g = new SubscriberGroupEntity();
    g.id = group.id;
    g.accountLinkId = group.accountLinkId;
    g.name = group.name;
    g.domain = group.domain;
    g.defaultFrom = group.defaultFrom;
    g.dataSource = (group.dataSource as Record<string, unknown> | null) ?? null;
    g.cronEnabled = group.cronEnabled;
    g.cronIntervalMinutes = group.cronIntervalMinutes;
    g.lastSyncAt = parseDate(group.lastSyncAt);
    g.lastSyncStatus = group.lastSyncStatus;
    g.lastSyncError = group.lastSyncError;
    g.lastSyncCount = group.lastSyncCount;
    g.createdAt = parseDateRequired(group.createdAt);
    g.updatedAt = g.createdAt;
    subscriberGroupRows.push(g);

    for (const contact of group.contacts) {
      const m = new SubscriberMemberEntity();
      m.id = contact.id;
      m.subscriberGroupId = group.id;
      m.email = contact.email.trim().toLowerCase();
      m.name = contact.name;
      m.source = contact.source;
      m.sendStatus = contact.sendStatus;
      m.unsubscribeToken = contact.unsubscribeToken;
      m.addedAt = parseDateRequired(contact.addedAt);
      m.consentedAt = parseDate(contact.consentedAt);
      m.consentSource = contact.consentSource;
      m.unsubscribedAt = parseDate(contact.unsubscribedAt);
      m.bouncedAt = parseDate(contact.bouncedAt);
      m.bounceReason = contact.bounceReason ?? null;
      subscriberMemberRows.push(m);
    }

    for (const run of group.syncHistory ?? []) {
      const s = new SubscriberSyncRunEntity();
      s.id = run.id;
      s.subscriberGroupId = group.id;
      s.trigger = run.trigger;
      s.status = run.status;
      s.phase = run.phase;
      s.totalCount = run.totalCount ?? null;
      s.processedCount = run.processedCount ?? null;
      s.skippedCount = run.skippedCount ?? null;
      s.successCount = run.successCount ?? null;
      s.failedCount = run.failedCount ?? null;
      s.error = run.error ?? null;
      s.startedAt = parseDateRequired(run.startedAt);
      s.finishedAt = parseDate(run.finishedAt);
      subscriberSyncRows.push(s);
    }
  }

  const newsletterRows = data.newsletters.map((row) => {
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
  });

  const recipientRows = data.recipients.map((row) => {
    const entity = new RecipientEntity();
    entity.id = row.id;
    entity.newsletterId = row.newsletterId;
    entity.subscriberMemberId = row.subscriberMemberId;
    entity.email = row.email;
    entity.name = row.name ?? null;
    entity.status = row.status;
    entity.errorMessage = row.errorMessage ?? null;
    entity.bounceReason = row.bounceReason ?? null;
    entity.openCount = row.openCount;
    entity.clickCount = row.clickCount;
    entity.sentAt = parseDate(row.sentAt);
    entity.deliveredAt = parseDate(row.deliveredAt);
    entity.openedAt = parseDate(row.openedAt);
    entity.clickedAt = parseDate(row.clickedAt);
    entity.unsubscribedAt = parseDate(row.unsubscribedAt);
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const trackingRows = data.trackingEvents.map((row) => {
    const entity = new TrackingEventEntity();
    entity.id = row.id;
    entity.newsletterId = row.newsletterId;
    entity.recipientId = row.recipientId;
    entity.memberEmail = row.memberEmail;
    entity.type = row.type;
    entity.url = row.url ?? null;
    entity.reason = row.reason ?? null;
    entity.occurredAt = parseDateRequired(row.occurredAt);
    return entity;
  });

  const triggerRows = data.triggers.map((row) => {
    const entity = new TriggerEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.messageId = row.messageId;
    entity.subscriberGroupId = row.subscriberGroupId ?? null;
    entity.complianceIdentityId = row.complianceIdentityId ?? null;
    entity.name = row.name;
    entity.slug = row.slug;
    entity.description = row.description ?? null;
    entity.domain = row.domain;
    entity.fromName = row.fromName ?? null;
    entity.fromEmail = row.fromEmail ?? null;
    entity.replyTo = row.replyTo ?? null;
    entity.purpose = row.purpose;
    entity.listStatus = row.listStatus;
    entity.status = row.status;
    entity.source = row.source as Record<string, unknown>;
    entity.cooldownSeconds = row.cooldownSeconds;
    entity.applyMarketingSuppression = row.applyMarketingSuppression;
    entity.stats = { ...row.stats };
    entity.lastTriggeredAt = parseDate(row.lastTriggeredAt);
    entity.lastSentAt = parseDate(row.lastSentAt);
    entity.createdAt = parseDateRequired(row.createdAt);
    entity.updatedAt = parseDateRequired(row.updatedAt);
    return entity;
  });

  const triggerEventRows = data.triggerEvents.map((row) => {
    const entity = new TriggerEventEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.triggerId = row.triggerId;
    entity.triggerType = row.triggerType;
    entity.idempotencyKey = row.idempotencyKey;
    entity.recipientEmail = row.recipientEmail;
    entity.recipientName = row.recipientName ?? null;
    entity.payload = row.payload;
    entity.status = row.status;
    entity.skipReason = row.skipReason ?? null;
    entity.occurredAt = parseDateRequired(row.occurredAt);
    return entity;
  });

  const triggerSendRows = data.triggerSends.map((row) => {
    const entity = new TriggerSendEntity();
    entity.id = row.id;
    entity.triggerId = row.triggerId;
    entity.triggerEventId = row.triggerEventId;
    entity.subscriberMemberId = row.subscriberMemberId ?? null;
    entity.email = row.email;
    entity.name = row.name ?? null;
    entity.status = row.status;
    entity.errorMessage = row.errorMessage ?? null;
    entity.bounceReason = row.bounceReason ?? null;
    entity.openCount = row.openCount;
    entity.clickCount = row.clickCount;
    entity.sentAt = parseDate(row.sentAt);
    entity.deliveredAt = parseDate(row.deliveredAt);
    entity.openedAt = parseDate(row.openedAt);
    entity.clickedAt = parseDate(row.clickedAt);
    entity.unsubscribedAt = parseDate(row.unsubscribedAt);
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const triggerTrackingRows = data.triggerTrackingEvents.map((row) => {
    const entity = new TriggerTrackingEventEntity();
    entity.id = row.id;
    entity.triggerId = row.triggerId;
    entity.triggerSendId = row.triggerSendId;
    entity.memberEmail = row.memberEmail;
    entity.type = row.type;
    entity.url = row.url ?? null;
    entity.reason = row.reason ?? null;
    entity.occurredAt = parseDateRequired(row.occurredAt);
    return entity;
  });

  const suppressionRows = data.accountSuppressions.map((row) => {
    const entity = new AccountSuppressionEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.email = row.email;
    entity.reason = row.reason;
    entity.subscriberGroupId = row.subscriberGroupId;
    entity.sourceNewsletterId = row.sourceNewsletterId ?? null;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const jobRows = data.scheduledJobs.map((row) => {
    const entity = new ScheduledJobEntity();
    entity.id = row.id;
    entity.accountLinkId = row.accountLinkId;
    entity.kind = row.kind;
    entity.refId = row.refId;
    entity.runAt = parseDateRequired(row.runAt);
    entity.status = row.status;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const pipelineRows = data.pipelineCards.map((row) => {
    const entity = new PipelineCardEntity();
    entity.id = row.id;
    entity.accountLinkId = account.id;
    entity.memberEmail = row.memberEmail;
    entity.memberName = row.memberName;
    entity.stage = row.stage;
    entity.note = row.note;
    entity.updatedAt = parseDateRequired(row.updatedAt);
    return entity;
  });

  const activityRows = data.activities.map((row) => {
    const entity = new ActivityEntity();
    entity.id = row.id;
    entity.accountLinkId = account.id;
    entity.memberEmail = row.memberEmail;
    entity.type = row.type;
    entity.payload = row.payload;
    entity.occurredAt = parseDateRequired(row.occurredAt);
    return entity;
  });

  const messageAssetRows = data.messageAssets.map((row) => {
    const entity = new MessageAssetEntity();
    entity.id = row.id;
    entity.key = row.key;
    entity.messageId = row.messageId;
    entity.filename = row.filename;
    entity.mimeType = row.mimeType;
    entity.contentBase64 = row.contentBase64;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const newsletterAssetRows = data.newsletterAssets.map((row) => {
    const entity = new NewsletterAssetEntity();
    entity.id = row.id;
    entity.key = row.key;
    entity.newsletterId = row.newsletterId;
    entity.filename = row.filename;
    entity.mimeType = row.mimeType;
    entity.contentBase64 = row.contentBase64;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  const triggerAssetRows = data.triggerAssets.map((row) => {
    const entity = new TriggerAssetEntity();
    entity.id = row.id;
    entity.key = row.key;
    entity.triggerId = row.triggerId;
    entity.filename = row.filename;
    entity.mimeType = row.mimeType;
    entity.contentBase64 = row.contentBase64;
    entity.createdAt = parseDateRequired(row.createdAt);
    return entity;
  });

  return {
    accountRow,
    complianceRows,
    layoutRows,
    templateRows,
    messageRows,
    subscriberGroupRows,
    subscriberMemberRows,
    subscriberSyncRows,
    newsletterRows,
    recipientRows,
    trackingRows,
    triggerRows,
    triggerEventRows,
    triggerSendRows,
    triggerTrackingRows,
    suppressionRows,
    jobRows,
    pipelineRows,
    activityRows,
    messageAssetRows,
    newsletterAssetRows,
    triggerAssetRows,
  };
}

async function main() {
  if (process.env.TYPEORM_SYNC !== "1") {
    console.error("Set TYPEORM_SYNC=1 so schema exists before import (dev only).");
    process.exit(1);
  }

  const dataSource = createStudioDataSource();
  await dataSource.initialize();

  const data = store.read();
  const auth = authStore.read();
  const mapped = mapStoreToEntities(data);

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await truncateAll(queryRunner);

    const repo = <T extends ObjectLiteral>(entity: EntityTarget<T>) =>
      queryRunner.manager.getRepository(entity);

    await repo(AccountLinkEntity).save(mapped.accountRow);
    await saveChunked(repo(ComplianceIdentityEntity), mapped.complianceRows);
    await saveChunked(repo(LayoutEntity), mapped.layoutRows);
    await saveChunked(repo(TemplateEntity), mapped.templateRows);
    await saveChunked(repo(MessageEntity), mapped.messageRows);
    await saveChunked(repo(SubscriberGroupEntity), mapped.subscriberGroupRows);
    await saveChunked(repo(SubscriberMemberEntity), mapped.subscriberMemberRows);
    await saveChunked(repo(SubscriberSyncRunEntity), mapped.subscriberSyncRows);
    await saveChunked(repo(NewsletterEntity), mapped.newsletterRows);
    await saveChunked(repo(TriggerEntity), mapped.triggerRows);
    await saveChunked(repo(RecipientEntity), mapped.recipientRows);
    await saveChunked(repo(TriggerEventEntity), mapped.triggerEventRows);
    await saveChunked(repo(TriggerSendEntity), mapped.triggerSendRows);
    await saveChunked(repo(TrackingEventEntity), mapped.trackingRows);
    await saveChunked(repo(TriggerTrackingEventEntity), mapped.triggerTrackingRows);
    await saveChunked(repo(AccountSuppressionEntity), mapped.suppressionRows);
    await saveChunked(repo(ScheduledJobEntity), mapped.jobRows);
    await saveChunked(repo(PipelineCardEntity), mapped.pipelineRows);
    await saveChunked(repo(ActivityEntity), mapped.activityRows);
    await saveChunked(repo(MessageAssetEntity), mapped.messageAssetRows);
    await saveChunked(repo(NewsletterAssetEntity), mapped.newsletterAssetRows);
    await saveChunked(repo(TriggerAssetEntity), mapped.triggerAssetRows);

    const userRows = auth.users.map((row) => {
      const entity = new HqAuthUserEntity();
      entity.id = row.id;
      entity.accountLinkId = row.accountLinkId;
      entity.email = row.email;
      entity.passwordHash = row.passwordHash;
      entity.name = row.name;
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.updatedAt = parseDateRequired(row.updatedAt);
      return entity;
    });
    await saveChunked(repo(HqAuthUserEntity), userRows);

    const refreshRows = auth.refreshTokens.map((row) => {
      const entity = new HqRefreshTokenEntity();
      entity.id = row.id;
      entity.tokenHash = row.tokenHash;
      entity.userId = row.userId;
      entity.expiresAt = parseDateRequired(row.expiresAt);
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.userAgent = row.userAgent;
      entity.ip = row.ip;
      return entity;
    });
    await saveChunked(repo(HqRefreshTokenEntity), refreshRows);

    const resetRows = auth.passwordResetTokens.map((row) => {
      const entity = new HqPasswordResetTokenEntity();
      entity.id = row.id;
      entity.tokenHash = row.tokenHash;
      entity.userId = row.userId;
      entity.expiresAt = parseDateRequired(row.expiresAt);
      entity.createdAt = parseDateRequired(row.createdAt);
      entity.used = row.used;
      return entity;
    });
    await saveChunked(repo(HqPasswordResetTokenEntity), resetRows);

    await queryRunner.commitTransaction();
    console.log("[orm:migrate:json] Import complete.");
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("[orm:migrate:json] Failed:", err);
  process.exit(1);
});
