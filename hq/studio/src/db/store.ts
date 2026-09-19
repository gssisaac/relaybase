import { loadStudioDataStore, persistStudioDataStore } from "./orm/postgres-persist";
import {
  commitPostgresStoreCache,
  readPostgresStoreClone,
  setPostgresStoreCache,
} from "./postgres-store-runtime";

import { emptyNewsletterStats, normalizeNewsletterStats } from "../lib/newsletters/stats";
import { normalizeTriggerStats } from "../lib/triggers/stats";
import { newId, newToken } from "../lib/shared/ids";
import { getBuiltinTemplates } from "../lib/templates/builtin-templates";
import { ensureDevScheduleFixtures } from "../lib/newsletters/dev-schedule-fixtures";
import { ensureOwnerMessageFiles } from "../lib/messages/ensure-owner-message-files";
import { templateCatalogStore } from "../lib/templates/template-catalog-store";
import { messageIdForOwner } from "../lib/messages/resolve";
import { ensureComplianceIdentitiesFromLegacy } from "../lib/compliance/identity";
import type { AccountComplianceSettings, Newsletter, StudioDataStore, Trigger } from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

function defaultCompliance(now: string): AccountComplianceSettings {
  return {
    organizationName: null,
    postalAddress: null,
    contactEmail: null,
    updatedAt: now,
  };
}

function defaultStore(): StudioDataStore {
  const now = new Date().toISOString();
  const complianceId = newId("compliance");
  return {
    account: {
      id: DEV_ACCOUNT_LINK_ID,
      workerUrl: null,
      domain: null,
      sendApiKey: null,
      compliance: defaultCompliance(now),
      defaultComplianceIdentityId: complianceId,
      createdAt: now,
    },
    complianceIdentities: [
      {
        id: complianceId,
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        name: "Default sender",
        organizationName: null,
        postalAddress: null,
        contactEmail: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    layouts: getBuiltinTemplates().map((tpl) => ({
      id: tpl.id,
      accountLinkId: null,
      name: tpl.name,
      htmlSource: tpl.htmlSource,
      variablesSchema: tpl.variablesSchema ?? null,
      isBuiltin: true,
      createdAt: now,
    })),
    templates: templateCatalogStore.listAll(),
    messages: [],
    newsletters: [],
    recipients: [],
    triggers: [],
    triggerEvents: [],
    triggerSends: [],
    triggerTrackingEvents: [],
    accountSuppressions: [],
    pipelineCards: [],
    activities: [],
    scheduledJobs: [],
    trackingEvents: [],
    newsletterAssets: [],
    triggerAssets: [],
    messageAssets: [],
    subscriberGroups: [],
  };
}

function mapLegacySubscriberGroupId(id: string): string {
  return id.startsWith("audience_") ? `subscriber_${id.slice("audience_".length)}` : id;
}

/** Renamed audience → subscriber on load (shards, fields, id prefixes). */
function migrateLegacyAudienceNaming(store: StudioDataStore): boolean {
  let touched = false;
  const legacy = store as StudioDataStore & { audienceGroups?: StudioDataStore["subscriberGroups"] };
  if ((!store.subscriberGroups || store.subscriberGroups.length === 0) && legacy.audienceGroups?.length) {
    store.subscriberGroups = legacy.audienceGroups;
    touched = true;
  }
  if (legacy.audienceGroups) {
    delete legacy.audienceGroups;
    touched = true;
  }
  if (!store.subscriberGroups) store.subscriberGroups = [];

  for (const group of store.subscriberGroups) {
    if (group.id.startsWith("audience_")) {
      group.id = mapLegacySubscriberGroupId(group.id);
      touched = true;
    }
  }

  const patchGroupId = (row: { subscriberGroupId?: string | null; audienceGroupId?: string | null }) => {
    if (row.subscriberGroupId === undefined && row.audienceGroupId !== undefined) {
      row.subscriberGroupId = row.audienceGroupId;
      touched = true;
    }
    if (row.audienceGroupId !== undefined) {
      delete row.audienceGroupId;
      touched = true;
    }
    if (row.subscriberGroupId) {
      const next = mapLegacySubscriberGroupId(row.subscriberGroupId);
      if (next !== row.subscriberGroupId) {
        row.subscriberGroupId = next;
        touched = true;
      }
    }
  };

  for (const row of store.newsletters) patchGroupId(row as typeof row & { audienceGroupId?: string });
  for (const row of store.triggers) patchGroupId(row);
  for (const row of store.accountSuppressions) patchGroupId(row);

  for (const row of store.recipients) {
    const legacyRow = row as typeof row & { audienceMemberId?: string };
    if (legacyRow.audienceMemberId !== undefined && !row.subscriberMemberId) {
      row.subscriberMemberId = legacyRow.audienceMemberId;
      touched = true;
    }
    if (legacyRow.audienceMemberId !== undefined) {
      delete legacyRow.audienceMemberId;
      touched = true;
    }
  }

  for (const row of store.triggerSends) {
    const legacyRow = row as typeof row & { audienceMemberId?: string | null };
    if (legacyRow.audienceMemberId !== undefined && row.subscriberMemberId === undefined) {
      row.subscriberMemberId = legacyRow.audienceMemberId;
      touched = true;
    }
    if (legacyRow.audienceMemberId !== undefined) {
      delete legacyRow.audienceMemberId;
      touched = true;
    }
  }

  return touched;
}

function normalizeStore(store: StudioDataStore): { store: StudioDataStore; newsletterNamesStripped: boolean } {
  const now = new Date().toISOString();
  let newsletterNamesStripped = false;
  if (!store.account.compliance) {
    store.account.compliance = defaultCompliance(now);
  } else {
    const c = store.account.compliance;
    if (c.organizationName === undefined) c.organizationName = null;
    if (c.postalAddress === undefined) c.postalAddress = null;
    if (c.contactEmail === undefined) c.contactEmail = null;
    if (!c.updatedAt) c.updatedAt = now;
  }
  ensureComplianceIdentitiesFromLegacy(store, now);

  if (store.account.sendApiKey === undefined) {
    store.account.sendApiKey = null;
  }

  if (!store.layouts) store.layouts = [];
  if (!store.templates) store.templates = templateCatalogStore.listAll();
  if (!store.messages) store.messages = [];

  if (!store.messageAssets) store.messageAssets = [];
  if (!store.triggers) store.triggers = [];
  if (!store.triggerEvents) store.triggerEvents = [];
  if (!store.triggerSends) store.triggerSends = [];
  if (!store.triggerTrackingEvents) store.triggerTrackingEvents = [];
  if (!store.newsletterAssets) store.newsletterAssets = [];
  if (!store.triggerAssets) store.triggerAssets = [];

  if (!store.scheduledJobs) store.scheduledJobs = [];
  if (!store.accountSuppressions) store.accountSuppressions = [];
  if (!store.recipients) store.recipients = [];
  if (!store.trackingEvents) store.trackingEvents = [];
  if (!store.pipelineCards) store.pipelineCards = [];
  if (!store.activities) store.activities = [];

  for (const job of store.scheduledJobs) {
    if (job.kind === "broadcast") job.kind = "newsletter";
  }

  for (const row of store.accountSuppressions) {
    if (row.subscriberGroupId === undefined) row.subscriberGroupId = null;
    if (row.sourceNewsletterId === undefined) row.sourceNewsletterId = null;
  }

  for (const row of store.newsletters) {
    const legacyRow = row as Newsletter & { templateId?: string; name?: string };
    if (legacyRow.name !== undefined) {
      delete legacyRow.name;
      newsletterNamesStripped = true;
    }
    const legacy = legacyRow;
    if (!row.messageId) {
      row.messageId = legacy.templateId ?? messageIdForOwner(row.id);
    }
    if (!row.subscriberGroupId) row.subscriberGroupId = "";
    if (!row.domain) {
      const group = store.subscriberGroups.find((g) => g.id === row.subscriberGroupId);
      row.domain = group?.domain ?? "";
    }
    row.stats = normalizeNewsletterStats(row.stats);
    if (row.startedAt === undefined) {
      row.startedAt =
        row.status === "draft" || row.status === "scheduled" ? null : (row.sentAt ?? null);
    }
    if (row.finishedAt === undefined) {
      row.finishedAt =
        row.status === "sent" || row.status === "failed" ? (row.updatedAt ?? row.sentAt ?? null) : null;
    }
  }

  for (const row of store.subscriberGroups) {
    for (const contact of row.contacts) {
      if (!contact.sendStatus) contact.sendStatus = "active";
      if (contact.unsubscribedAt === undefined) contact.unsubscribedAt = null;
      if (!contact.unsubscribeToken) contact.unsubscribeToken = newToken();
      if (contact.bouncedAt === undefined) contact.bouncedAt = null;
      if (contact.bounceReason === undefined) contact.bounceReason = null;
      if (contact.consentSource === undefined) {
        contact.consentSource = contact.source === "manual" ? "manual" : "synced";
      }
      if (contact.consentedAt === undefined) {
        contact.consentedAt = contact.sendStatus === "active" ? contact.addedAt : null;
      }

      if (contact.sendStatus === "unsubscribed") {
        const email = contact.email.trim().toLowerCase();
        const exists = store.accountSuppressions.some(
          (s) =>
            s.accountLinkId === row.accountLinkId &&
            s.email === email &&
            s.subscriberGroupId === row.id &&
            s.reason === "unsubscribe",
        );
        if (!exists) {
          store.accountSuppressions.push({
            id: newId("suppression"),
            accountLinkId: row.accountLinkId,
            email,
            reason: "unsubscribe",
            subscriberGroupId: row.id,
            sourceNewsletterId: null,
            createdAt: contact.unsubscribedAt ?? now,
          });
        }
      }
    }
  }

  const legacyHeader = store.layouts.find((t) => t.id === "tpl-header-image");
  const modernHeader = store.layouts.find((t) => t.id === "tpl-header");
  if (legacyHeader && !modernHeader) {
    legacyHeader.id = "tpl-header";
    legacyHeader.isBuiltin = true;
  }

  for (const builtin of getBuiltinTemplates()) {
    const existing = store.layouts.find((t) => t.id === builtin.id);
    if (existing?.isBuiltin) {
      existing.name = builtin.name;
      existing.htmlSource = builtin.htmlSource;
      existing.variablesSchema = builtin.variablesSchema ?? null;
      continue;
    }
    if (existing) continue;
    store.layouts.push({
      id: builtin.id,
      accountLinkId: null,
      name: builtin.name,
      htmlSource: builtin.htmlSource,
      variablesSchema: builtin.variablesSchema ?? null,
      isBuiltin: true,
      createdAt: now,
    });
  }

  for (const row of store.recipients) {
    if ((row.status as string) === "sent") row.status = "delivered";
    if (row.bounceReason === undefined) row.bounceReason = null;
    if (row.deliveredAt === undefined) {
      row.deliveredAt = row.status === "delivered" ? (row.sentAt ?? null) : null;
    }
    if (row.unsubscribedAt === undefined) row.unsubscribedAt = null;
  }

  for (const row of store.triggers) {
    const legacy = row as Trigger & { templateId?: string };
    if (!row.messageId) {
      row.messageId = legacy.templateId ?? messageIdForOwner(row.id);
    }
    if (row.cooldownSeconds === undefined) row.cooldownSeconds = 86_400;
    if (row.applyMarketingSuppression === undefined) {
      row.applyMarketingSuppression = row.purpose !== "transactional";
    }
    if (row.subscriberGroupId === undefined) row.subscriberGroupId = null;
    if (row.lastTriggeredAt === undefined) row.lastTriggeredAt = null;
    if (row.lastSentAt === undefined) row.lastSentAt = null;
    row.stats = normalizeTriggerStats(row.stats);
  }

  for (const row of store.triggerSends) {
    if (row.bounceReason === undefined) row.bounceReason = null;
    if (row.deliveredAt === undefined) {
      row.deliveredAt = row.status === "delivered" ? (row.sentAt ?? null) : null;
    }
    if (row.unsubscribedAt === undefined) row.unsubscribedAt = null;
    if (row.openCount === undefined) row.openCount = 0;
    if (row.clickCount === undefined) row.clickCount = 0;
  }

  return { store, newsletterNamesStripped };
}

function hydrateTemplates(store: StudioDataStore): StudioDataStore {
  store.templates = templateCatalogStore.listAll();
  return store;
}

export function reconcileAndHydrateStore(parsed: StudioDataStore): { store: StudioDataStore; dirty: boolean } {
  const legacyAudienceMigrated = migrateLegacyAudienceNaming(parsed);
  const { store: normalized, newsletterNamesStripped } = normalizeStore(parsed);
  let dirty = legacyAudienceMigrated || newsletterNamesStripped;
  const repairedOwnerMessages = ensureOwnerMessageFiles(normalized);
  dirty = dirty || repairedOwnerMessages;
  const store = hydrateTemplates(normalized);
  if (ensureDevScheduleFixtures(store)) dirty = true;
  return { store, dirty };
}

export async function initPostgresStudioStore(): Promise<void> {
  let loaded = await loadStudioDataStore();
  if (!loaded) {
    const seeded = reconcileAndHydrateStore(defaultStore());
    setPostgresStoreCache(seeded.store);
    await persistStudioDataStore(seeded.store);
    return;
  }

  const { store: reconciled, dirty } = reconcileAndHydrateStore(loaded);
  setPostgresStoreCache(reconciled);
  if (dirty) {
    await persistStudioDataStore(reconciled);
  }
}

/** In-memory PostgreSQL cache (authoritative at runtime). */
export const store = {
  read(): StudioDataStore {
    return readPostgresStoreClone();
  },
  update(mutator: (draft: StudioDataStore) => void): StudioDataStore {
    const draft = readPostgresStoreClone();
    mutator(draft);
    const { store: reconciled } = reconcileAndHydrateStore(draft);
    return commitPostgresStoreCache(reconciled);
  },
};
