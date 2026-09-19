import type { StudioDataStore } from "../types";
import {
  AccountLinkEntity,
  AccountSuppressionEntity,
  ActivityEntity,
  ComplianceIdentityEntity,
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

function iso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function isoRequired(value: Date | undefined, fallback = new Date()): string {
  return (value ? value.toISOString() : fallback.toISOString());
}

export function mapStoreToEntities(data: StudioDataStore) {
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

export function mapEntitiesToStore(input: {
  accountRow: AccountLinkEntity;
  complianceRows: ComplianceIdentityEntity[];
  layoutRows: LayoutEntity[];
  templateRows: TemplateEntity[];
  messageRows: MessageEntity[];
  subscriberGroupRows: SubscriberGroupEntity[];
  subscriberMemberRows: SubscriberMemberEntity[];
  subscriberSyncRows: SubscriberSyncRunEntity[];
  newsletterRows: NewsletterEntity[];
  recipientRows: RecipientEntity[];
  trackingRows: TrackingEventEntity[];
  triggerRows: TriggerEntity[];
  triggerEventRows: TriggerEventEntity[];
  triggerSendRows: TriggerSendEntity[];
  triggerTrackingRows: TriggerTrackingEventEntity[];
  suppressionRows: AccountSuppressionEntity[];
  jobRows: ScheduledJobEntity[];
  pipelineRows: PipelineCardEntity[];
  activityRows: ActivityEntity[];
  messageAssetRows: MessageAssetEntity[];
  newsletterAssetRows: NewsletterAssetEntity[];
  triggerAssetRows: TriggerAssetEntity[];
}): StudioDataStore {
  const accountRow = input.accountRow;
  const subscriberGroups = input.subscriberGroupRows.map((group) => {
    const contacts = input.subscriberMemberRows
      .filter((m) => m.subscriberGroupId === group.id)
      .map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name ?? "",
        source: m.source as "manual" | "synced" | "import",
        sendStatus: m.sendStatus as "active" | "unsubscribed" | "bounced",
        unsubscribeToken: m.unsubscribeToken,
        addedAt: isoRequired(m.addedAt),
        consentedAt: iso(m.consentedAt),
        consentSource: m.consentSource as "manual" | "synced" | "import" | undefined,
        unsubscribedAt: iso(m.unsubscribedAt),
        bouncedAt: iso(m.bouncedAt),
        bounceReason: m.bounceReason,
      }));

    const syncHistory = input.subscriberSyncRows
      .filter((s) => s.subscriberGroupId === group.id)
      .map((s) => ({
        id: s.id,
        trigger: s.trigger as "manual" | "cron",
        status: s.status as "running" | "completed" | "failed",
        phase: s.phase as "fetch" | "import" | "done",
        totalCount: s.totalCount ?? undefined,
        processedCount: s.processedCount ?? undefined,
        skippedCount: s.skippedCount ?? undefined,
        successCount: s.successCount ?? undefined,
        failedCount: s.failedCount ?? undefined,
        error: s.error ?? undefined,
        startedAt: isoRequired(s.startedAt),
        finishedAt: iso(s.finishedAt),
      }));

    return {
      id: group.id,
      accountLinkId: group.accountLinkId,
      name: group.name,
      domain: group.domain,
      defaultFrom: group.defaultFrom ?? "",
      dataSource: group.dataSource ?? null,
      cronEnabled: group.cronEnabled,
      cronIntervalMinutes: group.cronIntervalMinutes,
      lastSyncAt: iso(group.lastSyncAt),
      lastSyncStatus: group.lastSyncStatus as "success" | "failed" | null,
      lastSyncError: group.lastSyncError,
      lastSyncCount: group.lastSyncCount,
      createdAt: isoRequired(group.createdAt),
      contacts,
      syncHistory,
    };
  });

  const store: StudioDataStore = {
    account: {
      id: accountRow.id,
      workerUrl: accountRow.workerUrl,
      domain: accountRow.domain,
      sendApiKey: accountRow.sendApiKey ?? null,
      compliance: {
        organizationName: accountRow.organizationName,
        postalAddress: accountRow.postalAddress,
        contactEmail: accountRow.contactEmail,
        updatedAt: iso(accountRow.complianceUpdatedAt) ?? isoRequired(accountRow.updatedAt),
      },
      defaultComplianceIdentityId: accountRow.defaultComplianceIdentityId,
      createdAt: isoRequired(accountRow.createdAt),
    },
    complianceIdentities: input.complianceRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      name: row.name,
      organizationName: row.organizationName,
      postalAddress: row.postalAddress,
      contactEmail: row.contactEmail,
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    layouts: input.layoutRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      name: row.name,
      htmlSource: row.htmlSource,
      variablesSchema: row.variablesSchema as StudioDataStore["layouts"][0]["variablesSchema"],
      isBuiltin: row.isBuiltin,
      derivedFromLayoutId: row.derivedFromLayoutId,
      createdAt: isoRequired(row.createdAt),
    })),
    templates: input.templateRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      subject: row.subject,
      previewText: row.previewText,
      bodyMarkdown: row.bodyMarkdown,
      layoutId: row.layoutId,
      templateVariables: row.templateVariables ?? {},
      category: row.category as StudioDataStore["templates"][0]["category"],
      isBuiltin: true as const,
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    messages: input.messageRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      name: row.name,
      subject: row.subject,
      previewText: row.previewText,
      bodyMarkdown: row.bodyMarkdown,
      layoutId: row.layoutId,
      templateVariables: row.templateVariables ?? {},
      forkedFromTemplateId: row.forkedFromTemplateId,
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    newsletters: input.newsletterRows.map((row) => ({
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
      listStatus: row.listStatus as StudioDataStore["newsletters"][0]["listStatus"],
      status: row.status as StudioDataStore["newsletters"][0]["status"],
      scheduledAt: iso(row.scheduledAt),
      startedAt: iso(row.startedAt),
      sentAt: iso(row.sentAt),
      finishedAt: iso(row.finishedAt),
      targetFilter: row.targetFilter as StudioDataStore["newsletters"][0]["targetFilter"],
      stats: row.stats as StudioDataStore["newsletters"][0]["stats"],
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    recipients: input.recipientRows.map((row) => ({
      id: row.id,
      newsletterId: row.newsletterId,
      subscriberMemberId: row.subscriberMemberId ?? "",
      email: row.email,
      name: row.name ?? undefined,
      status: row.status as StudioDataStore["recipients"][0]["status"],
      errorMessage: row.errorMessage,
      bounceReason: row.bounceReason,
      openCount: row.openCount,
      clickCount: row.clickCount,
      sentAt: iso(row.sentAt),
      deliveredAt: iso(row.deliveredAt),
      openedAt: iso(row.openedAt),
      clickedAt: iso(row.clickedAt),
      unsubscribedAt: iso(row.unsubscribedAt),
      createdAt: isoRequired(row.createdAt),
    })),
    trackingEvents: input.trackingRows.map((row) => ({
      id: row.id,
      newsletterId: row.newsletterId,
      recipientId: row.recipientId,
      memberEmail: row.memberEmail,
      type: row.type as StudioDataStore["trackingEvents"][0]["type"],
      url: row.url,
      reason: row.reason,
      occurredAt: isoRequired(row.occurredAt),
    })),
    triggers: input.triggerRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      messageId: row.messageId,
      subscriberGroupId: row.subscriberGroupId,
      complianceIdentityId: row.complianceIdentityId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      domain: row.domain,
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      replyTo: row.replyTo,
      purpose: row.purpose as StudioDataStore["triggers"][0]["purpose"],
      listStatus: row.listStatus as StudioDataStore["triggers"][0]["listStatus"],
      status: row.status as StudioDataStore["triggers"][0]["status"],
      source: row.source as StudioDataStore["triggers"][0]["source"],
      cooldownSeconds: row.cooldownSeconds,
      applyMarketingSuppression: row.applyMarketingSuppression,
      stats: row.stats as StudioDataStore["triggers"][0]["stats"],
      lastTriggeredAt: iso(row.lastTriggeredAt),
      lastSentAt: iso(row.lastSentAt),
      createdAt: isoRequired(row.createdAt),
      updatedAt: isoRequired(row.updatedAt),
    })),
    triggerEvents: input.triggerEventRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      triggerId: row.triggerId,
      triggerType: row.triggerType as StudioDataStore["triggerEvents"][0]["triggerType"],
      idempotencyKey: row.idempotencyKey,
      recipientEmail: row.recipientEmail,
      recipientName: row.recipientName,
      payload: row.payload as StudioDataStore["triggerEvents"][0]["payload"],
      status: row.status as StudioDataStore["triggerEvents"][0]["status"],
      skipReason: row.skipReason as StudioDataStore["triggerEvents"][0]["skipReason"],
      occurredAt: isoRequired(row.occurredAt),
    })),
    triggerSends: input.triggerSendRows.map((row) => ({
      id: row.id,
      triggerId: row.triggerId,
      triggerEventId: row.triggerEventId,
      subscriberMemberId: row.subscriberMemberId,
      email: row.email,
      name: row.name ?? undefined,
      status: row.status as StudioDataStore["triggerSends"][0]["status"],
      errorMessage: row.errorMessage,
      bounceReason: row.bounceReason,
      openCount: row.openCount,
      clickCount: row.clickCount,
      sentAt: iso(row.sentAt),
      deliveredAt: iso(row.deliveredAt),
      openedAt: iso(row.openedAt),
      clickedAt: iso(row.clickedAt),
      unsubscribedAt: iso(row.unsubscribedAt),
      createdAt: isoRequired(row.createdAt),
    })),
    triggerTrackingEvents: input.triggerTrackingRows.map((row) => ({
      id: row.id,
      triggerId: row.triggerId,
      triggerSendId: row.triggerSendId,
      memberEmail: row.memberEmail,
      type: row.type as StudioDataStore["triggerTrackingEvents"][0]["type"],
      url: row.url,
      reason: row.reason,
      occurredAt: isoRequired(row.occurredAt),
    })),
    accountSuppressions: input.suppressionRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      email: row.email,
      reason: row.reason as StudioDataStore["accountSuppressions"][0]["reason"],
      subscriberGroupId: row.subscriberGroupId,
      sourceNewsletterId: row.sourceNewsletterId,
      createdAt: isoRequired(row.createdAt),
    })),
    scheduledJobs: input.jobRows.map((row) => ({
      id: row.id,
      accountLinkId: row.accountLinkId,
      kind: row.kind as StudioDataStore["scheduledJobs"][0]["kind"],
      refId: row.refId,
      runAt: isoRequired(row.runAt),
      status: row.status as StudioDataStore["scheduledJobs"][0]["status"],
      createdAt: isoRequired(row.createdAt),
    })),
    pipelineCards: input.pipelineRows.map((row) => ({
      id: row.id,
      memberEmail: row.memberEmail,
      memberName: row.memberName,
      stage: row.stage as StudioDataStore["pipelineCards"][0]["stage"],
      note: row.note,
      updatedAt: isoRequired(row.updatedAt),
    })),
    activities: input.activityRows.map((row) => ({
      id: row.id,
      memberEmail: row.memberEmail,
      type: row.type,
      payload: row.payload as StudioDataStore["activities"][0]["payload"],
      occurredAt: isoRequired(row.occurredAt),
    })),
    messageAssets: input.messageAssetRows.map((row) => ({
      id: row.id,
      key: row.key,
      messageId: row.messageId,
      filename: row.filename,
      mimeType: row.mimeType,
      contentBase64: row.contentBase64,
      createdAt: isoRequired(row.createdAt),
    })),
    newsletterAssets: input.newsletterAssetRows.map((row) => ({
      id: row.id,
      key: row.key,
      newsletterId: row.newsletterId,
      filename: row.filename,
      mimeType: row.mimeType,
      contentBase64: row.contentBase64,
      createdAt: isoRequired(row.createdAt),
    })),
    triggerAssets: input.triggerAssetRows.map((row) => ({
      id: row.id,
      key: row.key,
      triggerId: row.triggerId,
      filename: row.filename,
      mimeType: row.mimeType,
      contentBase64: row.contentBase64,
      createdAt: isoRequired(row.createdAt),
    })),
    subscriberGroups: subscriberGroups as StudioDataStore["subscriberGroups"],
  };

  return store;
}
