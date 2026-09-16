import fs from "node:fs";
import path from "node:path";

import { emptyNewsletterStats, normalizeNewsletterStats } from "../lib/newsletters/stats";
import { normalizeTriggerStats } from "../lib/triggers/stats";
import { newId, newToken } from "../lib/shared/ids";
import { getBuiltinTemplates } from "../lib/templates/builtin-templates";
import { ensureDevScheduleFixtures } from "../lib/newsletters/dev-schedule-fixtures";
import { ensureOwnerMessageFiles } from "../lib/messages/ensure-owner-message-files";
import { messageFileStore } from "../lib/messages/message-file-store";
import { templateCatalogStore } from "../lib/templates/template-catalog-store";
import { ensureComplianceIdentitiesFromLegacy } from "../lib/compliance/identity";
import type { AccountComplianceSettings, Message, StudioDataStore, Template } from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DATA_DIR =
  process.env.STUDIO_DATA_DIR ??
  process.env.STUDIO_DATA_DIR ??
  path.join(process.cwd(), "data");

const STORE_FILE = path.join(DATA_DIR, "store.json");

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
    messages: messageFileStore.listAll(),
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
    audienceGroups: [],
  };
}

function normalizeStore(store: StudioDataStore): StudioDataStore {
  const now = new Date().toISOString();
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
  if (!store.messages) store.messages = messageFileStore.listAll();
  if (!store.newsletters) store.newsletters = [];

  if (!store.messageAssets) store.messageAssets = [];
  if (!store.triggers) store.triggers = [];
  if (!store.triggerEvents) store.triggerEvents = [];
  if (!store.triggerSends) store.triggerSends = [];
  if (!store.triggerTrackingEvents) store.triggerTrackingEvents = [];
  if (!store.newsletterAssets) store.newsletterAssets = [];
  if (!store.triggerAssets) store.triggerAssets = [];

  for (const job of store.scheduledJobs) {
    if (job.kind === "broadcast") job.kind = "newsletter";
  }

  for (const row of store.accountSuppressions) {
    if (row.audienceGroupId === undefined) row.audienceGroupId = null;
    if (row.sourceNewsletterId === undefined) row.sourceNewsletterId = null;
  }

  for (const row of store.newsletters) {
    if (!row.audienceGroupId) row.audienceGroupId = "";
    if (!row.domain) {
      const group = store.audienceGroups.find((g) => g.id === row.audienceGroupId);
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

  for (const row of store.audienceGroups) {
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
            s.audienceGroupId === row.id &&
            s.reason === "unsubscribe",
        );
        if (!exists) {
          store.accountSuppressions.push({
            id: newId("suppression"),
            accountLinkId: row.accountLinkId,
            email,
            reason: "unsubscribe",
            audienceGroupId: row.id,
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
    if (row.cooldownSeconds === undefined) row.cooldownSeconds = 86_400;
    if (row.applyMarketingSuppression === undefined) {
      row.applyMarketingSuppression = row.purpose !== "transactional";
    }
    if (row.audienceGroupId === undefined) row.audienceGroupId = null;
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

  return store;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): StudioDataStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = hydrateTemplates(defaultStore());
    writeStore(initial);
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as StudioDataStore;
    let migratedLegacyTemplates = false;
    if (Array.isArray(parsed.templates) && parsed.templates.length > 0) {
      const legacy = parsed.templates as (Template & {
        isPreset?: boolean;
        accountLinkId?: string;
      })[];
      const messageRows = legacy
        .filter((row) => !row.isPreset)
        .map(
          (row): Message => ({
            id: row.id,
            accountLinkId: row.accountLinkId ?? DEV_ACCOUNT_LINK_ID,
            name: row.name,
            subject: row.subject,
            previewText: row.previewText ?? null,
            bodyMarkdown: row.bodyMarkdown,
            layoutId: row.layoutId ?? null,
            templateVariables: row.templateVariables ?? {},
            forkedFromTemplateId: null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }),
        );
      if (messageRows.length > 0) {
        messageFileStore.importFromLegacyRows(messageRows);
      }
      templateCatalogStore.listAll();
      delete (parsed as { templates?: Template[] }).templates;
      migratedLegacyTemplates = true;
    }
    const normalized = normalizeStore(parsed);
    const repairedOwnerMessages = ensureOwnerMessageFiles(normalized);
    const store = hydrateTemplates(normalized);
    if (migratedLegacyTemplates || ensureDevScheduleFixtures(store) || repairedOwnerMessages) {
      writeStore(store);
    }
    return store;
  } catch {
    const initial = hydrateTemplates(defaultStore());
    writeStore(initial);
    return initial;
  }
}

function writeStore(store: StudioDataStore) {
  ensureDataDir();
  const {
    templates: _templates,
    messages: _messages,
    ...persisted
  } = store;
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
}

function hydrateTemplates(store: StudioDataStore): StudioDataStore {
  store.templates = templateCatalogStore.listAll();
  store.messages = messageFileStore.listAll();
  return store;
}

/** Synchronous JSON file store — dev environment; production D1 database to follow. */
export const store = {
  read(): StudioDataStore {
    return readStore();
  },
  update(mutator: (draft: StudioDataStore) => void): StudioDataStore {
    const draft = readStore();
    mutator(draft);
    writeStore(draft);
    return hydrateTemplates(draft);
  },
  dataDir: DATA_DIR,
};
