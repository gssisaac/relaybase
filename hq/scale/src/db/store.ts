import fs from "node:fs";
import path from "node:path";

import { emptyBroadcastStats, normalizeBroadcastStats } from "../lib/broadcasts/stats";
import { normalizeAutomationStats } from "../lib/automations/stats";
import { newId, newToken } from "../lib/shared/ids";
import { getBuiltinTemplates } from "../lib/templates/builtin-templates";
import { ensureComplianceIdentitiesFromLegacy } from "../lib/compliance/identity";
import type { AccountComplianceSettings, Broadcast, BroadcastAsset, ScaleDataStore, Recipient } from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DATA_DIR =
  process.env.SCALE_DATA_DIR ??
  process.env.CRM_DATA_DIR ??
  path.join(process.cwd(), "data");

const STORE_FILE = path.join(DATA_DIR, "store.json");

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

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
    broadcasts: [],
    recipients: [],
    automations: [],
    triggerEvents: [],
    automationSends: [],
    automationTrackingEvents: [],
    accountSuppressions: [],
    pipelineCards: [],
    activities: [],
    templates: getBuiltinTemplates().map((tpl) => ({
      id: tpl.id,
      accountLinkId: null,
      name: tpl.name,
      htmlSource: tpl.htmlSource,
      variablesSchema: tpl.variablesSchema ?? null,
      isBuiltin: true,
      createdAt: now,
    })),
    scheduledJobs: [],
    trackingEvents: [],
    broadcastAssets: [],
    automationAssets: [],
    audienceGroups: [],
  };
}

type LegacyBroadcastMember = {
  id?: string;
  audienceMemberId?: string | null;
  email?: string;
  unsubscribeToken?: string;
  status?: string;
  unsubscribedAt?: string | null;
  bouncedAt?: string | null;
  bounceReason?: string | null;
  broadcastId?: string;
};

/** One-time migration from campaign + nested broadcast + subscriber model. */
function migrateLegacyStore(raw: Record<string, unknown>): ScaleDataStore {
  const parsed = raw as ScaleDataStore & {
    campaigns?: Array<Record<string, unknown>>;
    subscribers?: Array<Record<string, unknown>>;
    campaignAssets?: Array<Record<string, unknown>>;
    broadcasts?: Array<Record<string, unknown>>;
    broadcastMembers?: LegacyBroadcastMember[];
  };

  if (!parsed.broadcastAssets) parsed.broadcastAssets = [];
  if (!parsed.automations) parsed.automations = [];
  if (!parsed.triggerEvents) parsed.triggerEvents = [];
  if (!parsed.automationSends) parsed.automationSends = [];
  if (!parsed.automationTrackingEvents) parsed.automationTrackingEvents = [];
  if (!parsed.automationAssets) parsed.automationAssets = [];
  if (!parsed.broadcasts) parsed.broadcasts = [];

  const legacyCampaigns = parsed.campaigns ?? [];
  const legacySubs = parsed.subscribers ?? [];
  const legacyBroadcasts = (parsed.broadcasts ?? []) as Array<Record<string, unknown>>;

  if (legacyCampaigns.length > 0 || legacySubs.length > 0) {
    const nextBroadcasts: Broadcast[] = [];

    for (const campaign of legacyCampaigns) {
      const campaignId = String(campaign.id ?? "");
      const sends = legacyBroadcasts.filter((b) => b.campaignId === campaignId);

      const targets =
        sends.length > 0
          ? sends
          : [
              {
                id: campaignId,
                campaignId,
                subject: "",
                previewText: null,
                bodyMarkdown: "",
                templateId: campaign.defaultTemplateId ?? null,
                status: "draft",
                scheduledAt: null,
                sentAt: null,
                stats: emptyBroadcastStats(),
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt,
              },
            ];

      for (const send of targets) {
        const broadcastId = String(send.id ?? newId("broadcast"));
        const name =
          String(campaign.name ?? "").trim() ||
          String(send.subject ?? "").trim() ||
          "Untitled broadcast";
        const slugBase = slugify(String(campaign.slug ?? name)) || broadcastId.slice(0, 12);

        nextBroadcasts.push({
          id: broadcastId,
          accountLinkId: String(campaign.accountLinkId ?? DEV_ACCOUNT_LINK_ID),
          name,
          slug: slugBase,
          description: (campaign.description as string | null | undefined) ?? null,
          audienceGroupId: String(campaign.audienceGroupId ?? ""),
          domain: "",
          fromName: (campaign.fromName as string | null | undefined) ?? null,
          fromEmail: (campaign.fromEmail as string | null | undefined) ?? null,
          replyTo: (campaign.replyTo as string | null | undefined) ?? null,
          defaultTemplateId: (campaign.defaultTemplateId as string | null | undefined) ?? null,
          listStatus: campaign.status === "archived" ? "archived" : "active",
          subject: String(send.subject ?? ""),
          previewText: (send.previewText as string | null | undefined) ?? null,
          bodyMarkdown: String(send.bodyMarkdown ?? ""),
          templateId: (send.templateId as string | null | undefined) ?? null,
          status: (send.status as Broadcast["status"]) ?? "draft",
          scheduledAt: (send.scheduledAt as string | null | undefined) ?? null,
          sentAt: (send.sentAt as string | null | undefined) ?? null,
          targetFilter: send.targetFilter as Record<string, unknown> | undefined,
          stats: normalizeBroadcastStats(send.stats as Broadcast["stats"]),
          createdAt: String(send.createdAt ?? campaign.createdAt ?? new Date().toISOString()),
          updatedAt: String(send.updatedAt ?? campaign.updatedAt ?? new Date().toISOString()),
        });
      }
    }

    parsed.broadcasts = nextBroadcasts;
    delete parsed.campaigns;
    delete parsed.subscribers;
  }

  const audienceGroupsForMigrate = (parsed.audienceGroups ?? []) as Array<{
    id: string;
    domain?: string;
  }>;

  for (const row of parsed.broadcasts as Array<Record<string, unknown>>) {
    if (row.campaignId && !row.audienceGroupId) {
      row.audienceGroupId = "";
    }
    if (!row.name) row.name = String(row.subject ?? "Untitled broadcast");
    if (!row.slug) row.slug = slugify(String(row.name)) || String(row.id).slice(0, 12);
    if (!row.listStatus) row.listStatus = "active";
    if (!row.domain && row.audienceGroupId) {
      const group = audienceGroupsForMigrate.find((g) => g.id === row.audienceGroupId);
      if (group?.domain) row.domain = group.domain;
    }
    if (!row.domain) row.domain = "";
    row.stats = normalizeBroadcastStats(row.stats as Broadcast["stats"]);
    delete row.campaignId;
  }

  for (const row of (parsed.recipients ?? []) as Array<Record<string, unknown>>) {
    if (!row.audienceMemberId && row.broadcastMemberId) {
      /* filled from broadcastMembers migration below */
    }
    if (row.subscriberId && !row.audienceMemberId) {
      row.audienceMemberId = row.subscriberId;
    }
    if (row.status === "sent") row.status = "delivered";
    delete row.subscriberId;
    delete row.broadcastMemberId;
    delete row.campaignId;
  }

  if (parsed.campaignAssets?.length) {
    parsed.broadcastAssets = parsed.campaignAssets.map((a) => ({
      id: String(a.id ?? newId("asset")),
      key: String(a.key ?? "").replace(/^[^/]+\//, (m) => m),
      broadcastId: String(a.campaignId ?? a.broadcastId ?? ""),
      filename: String(a.filename ?? ""),
      mimeType: String(a.mimeType ?? "application/octet-stream"),
      contentBase64: String(a.contentBase64 ?? ""),
      createdAt: String(a.createdAt ?? new Date().toISOString()),
    })) as BroadcastAsset[];
    delete parsed.campaignAssets;
  }

  const legacyMembers = parsed.broadcastMembers ?? [];
  if (legacyMembers.length > 0 && parsed.audienceGroups) {
    const tokenByContactId = new Map<string, string>();
    for (const bm of legacyMembers) {
      const contactId = bm.audienceMemberId;
      if (contactId && bm.unsubscribeToken) {
        tokenByContactId.set(contactId, bm.unsubscribeToken);
      }
    }

    for (const group of parsed.audienceGroups) {
      for (const contact of group.contacts) {
        const fromMember = legacyMembers.find((bm) => bm.audienceMemberId === contact.id);
        if (fromMember?.unsubscribeToken) {
          contact.unsubscribeToken = fromMember.unsubscribeToken;
        } else if (!contact.unsubscribeToken) {
          contact.unsubscribeToken = newToken();
        }
        if (fromMember?.status === "unsubscribed" || fromMember?.status === "subscribed") {
          const st = fromMember.status === "unsubscribed" ? "unsubscribed" : "active";
          contact.sendStatus = st;
          contact.unsubscribedAt = fromMember.unsubscribedAt ?? contact.unsubscribedAt ?? null;
        }
        if (fromMember?.status === "bounced") {
          contact.sendStatus = "bounced";
          contact.bouncedAt = fromMember.bouncedAt ?? null;
          contact.bounceReason = fromMember.bounceReason ?? null;
        }
        if (!tokenByContactId.has(contact.id) && contact.unsubscribeToken) {
          tokenByContactId.set(contact.id, contact.unsubscribeToken);
        }
      }
    }

    for (const row of (parsed.recipients ?? []) as Array<Record<string, unknown>>) {
      if (!row.audienceMemberId && row.broadcastMemberId) {
        const bm = legacyMembers.find((m) => m.id === row.broadcastMemberId);
        if (bm?.audienceMemberId) row.audienceMemberId = bm.audienceMemberId;
      }
    }
  }

  delete parsed.broadcastMembers;

  return parsed as ScaleDataStore;
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

  for (const row of store.accountSuppressions) {
    if (row.audienceGroupId === undefined) row.audienceGroupId = null;
    if (row.sourceBroadcastId === undefined) row.sourceBroadcastId = null;
  }

  for (const row of store.broadcasts) {
    if (!row.audienceGroupId) row.audienceGroupId = "";
    if (!row.domain) {
      const group = store.audienceGroups.find((g) => g.id === row.audienceGroupId);
      row.domain = group?.domain ?? "";
    }
    row.stats = normalizeBroadcastStats(row.stats);
    if (row.startedAt === undefined) {
      row.startedAt = row.status === "draft" || row.status === "scheduled" ? null : (row.sentAt ?? null);
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
            sourceBroadcastId: null,
            createdAt: contact.unsubscribedAt ?? now,
          });
        }
      }
    }
  }

  const legacyHeader = store.templates.find((t) => t.id === "tpl-header-image");
  const modernHeader = store.templates.find((t) => t.id === "tpl-header");
  if (legacyHeader && !modernHeader) {
    legacyHeader.id = "tpl-header";
    legacyHeader.isBuiltin = true;
  }
  for (const b of store.broadcasts) {
    if (b.templateId === "tpl-header-image") b.templateId = "tpl-header";
    if (b.defaultTemplateId === "tpl-header-image") b.defaultTemplateId = "tpl-header";
  }

  for (const tpl of getBuiltinTemplates()) {
    const existing = store.templates.find((t) => t.id === tpl.id);
    if (existing?.isBuiltin) {
      existing.name = tpl.name;
      existing.htmlSource = tpl.htmlSource;
      existing.variablesSchema = tpl.variablesSchema ?? null;
      continue;
    }
    if (existing) continue;
    store.templates.push({
      id: tpl.id,
      accountLinkId: null,
      name: tpl.name,
      htmlSource: tpl.htmlSource,
      variablesSchema: tpl.variablesSchema ?? null,
      isBuiltin: true,
      createdAt: now,
    });
  }

  for (const row of store.recipients) {
    const legacy = row as Recipient & { broadcastMemberId?: string };
    if (!row.audienceMemberId && legacy.broadcastMemberId) {
      row.audienceMemberId = legacy.broadcastMemberId;
    }
    if ((row.status as string) === "sent") row.status = "delivered";
    if (row.bounceReason === undefined) row.bounceReason = null;
    if (row.deliveredAt === undefined) {
      row.deliveredAt = row.status === "delivered" ? (row.sentAt ?? null) : null;
    }
    if (row.unsubscribedAt === undefined) row.unsubscribedAt = null;
  }

  if (!store.automations) store.automations = [];
  if (!store.triggerEvents) store.triggerEvents = [];
  if (!store.automationSends) store.automationSends = [];
  if (!store.automationTrackingEvents) store.automationTrackingEvents = [];
  if (!store.automationAssets) store.automationAssets = [];

  for (const row of store.automations) {
    if (row.cooldownSeconds === undefined) row.cooldownSeconds = 86_400;
    if (row.applyMarketingSuppression === undefined) {
      row.applyMarketingSuppression = row.purpose !== "transactional";
    }
    if (row.audienceGroupId === undefined) row.audienceGroupId = null;
    if (row.templateVariables === undefined) row.templateVariables = {};
    if (row.lastTriggeredAt === undefined) row.lastTriggeredAt = null;
    if (row.lastSentAt === undefined) row.lastSentAt = null;
    row.stats = normalizeAutomationStats(row.stats);
  }

  for (const row of store.automationSends) {
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeStore(migrateLegacyStore(parsed));
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
