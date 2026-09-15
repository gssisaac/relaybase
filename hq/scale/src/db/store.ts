import fs from "node:fs";
import path from "node:path";

import { emptyCampaignStats, normalizeCampaignStats } from "../lib/campaigns/stats";
import { normalizeTriggerStats } from "../lib/triggers/stats";
import { newId, newToken } from "../lib/shared/ids";
import { getBuiltinTemplates } from "../lib/templates/builtin-templates";
import { ensureDevScheduleFixtures } from "../lib/campaigns/dev-schedule-fixtures";
import { getPresetMessageTemplates } from "../lib/messages/preset-templates";
import { ensureComplianceIdentitiesFromLegacy } from "../lib/compliance/identity";
import type { AccountComplianceSettings, ScaleDataStore } from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DATA_DIR =
  process.env.SCALE_DATA_DIR ??
  process.env.CRM_DATA_DIR ??
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

function defaultStore(): ScaleDataStore {
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
    templates: [],
    campaigns: [],
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
    campaignAssets: [],
    triggerAssets: [],
    templateAssets: [],
    audienceGroups: [],
  };
}

function normalizeStore(store: ScaleDataStore): ScaleDataStore {
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
  if (!store.templates) store.templates = [];
  if (!store.campaigns) store.campaigns = [];
  if (!store.triggers) store.triggers = [];
  if (!store.triggerEvents) store.triggerEvents = [];
  if (!store.triggerSends) store.triggerSends = [];
  if (!store.triggerTrackingEvents) store.triggerTrackingEvents = [];
  if (!store.campaignAssets) store.campaignAssets = [];
  if (!store.triggerAssets) store.triggerAssets = [];
  if (!store.templateAssets) store.templateAssets = [];

  if (store.templates.length === 0) {
    for (const preset of getPresetMessageTemplates(now)) {
      store.templates.push(preset);
    }
  }

  for (const job of store.scheduledJobs) {
    if (job.kind === "broadcast") job.kind = "campaign";
  }

  for (const row of store.accountSuppressions) {
    if (row.audienceGroupId === undefined) row.audienceGroupId = null;
    if (row.sourceCampaignId === undefined) row.sourceCampaignId = null;
  }

  for (const row of store.campaigns) {
    if (!row.audienceGroupId) row.audienceGroupId = "";
    if (!row.domain) {
      const group = store.audienceGroups.find((g) => g.id === row.audienceGroupId);
      row.domain = group?.domain ?? "";
    }
    row.stats = normalizeCampaignStats(row.stats);
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
            sourceCampaignId: null,
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

  for (const tpl of store.templates) {
    if (tpl.layoutId === "tpl-header-image") tpl.layoutId = "tpl-header";
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

function readStore(): ScaleDataStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as ScaleDataStore;
    const store = normalizeStore(parsed);
    if (ensureDevScheduleFixtures(store)) {
      writeStore(store);
    }
    return store;
  } catch {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
}

function writeStore(store: ScaleDataStore) {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

/** Synchronous JSON file store — dev environment; production D1 database to follow. */
export const store = {
  read(): ScaleDataStore {
    return readStore();
  },
  update(mutator: (draft: ScaleDataStore) => void): ScaleDataStore {
    const draft = readStore();
    mutator(draft);
    writeStore(draft);
    return draft;
  },
  dataDir: DATA_DIR,
};
