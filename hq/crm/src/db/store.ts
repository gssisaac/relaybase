import fs from "node:fs";
import path from "node:path";

import { BUILTIN_TEMPLATES } from "../lib/builtin-templates";
import { newId, newToken } from "../lib/ids";
import type {
  Broadcast,
  BroadcastAsset,
  BroadcastMember,
  BroadcastMemberStatus,
  CrmDataStore,
} from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DATA_DIR = process.env.CRM_DATA_DIR ?? path.join(process.cwd(), "data");

const STORE_FILE = path.join(DATA_DIR, "store.json");

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultStore(): CrmDataStore {
  const now = new Date().toISOString();
  return {
    account: {
      id: DEV_ACCOUNT_LINK_ID,
      workerUrl: null,
      domain: null,
      createdAt: now,
    },
    broadcasts: [],
    broadcastMembers: [],
    recipients: [],
    accountSuppressions: [],
    pipelineCards: [],
    activities: [],
    templates: BUILTIN_TEMPLATES.map((tpl) => ({
      id: tpl.id,
      accountLinkId: null,
      name: tpl.name,
      htmlSource: tpl.htmlSource,
      isBuiltin: true,
      createdAt: now,
    })),
    scheduledJobs: [],
    trackingEvents: [],
    broadcastAssets: [],
    audienceGroups: [],
  };
}

function mapLegacySubscriberStatus(status: string): BroadcastMemberStatus {
  if (status === "subscribed") return "active";
  if (status === "unsubscribed" || status === "bounced" || status === "pending") {
    return status as BroadcastMemberStatus;
  }
  return "active";
}

/** One-time migration from campaign + nested broadcast + subscriber model. */
function migrateLegacyStore(raw: Record<string, unknown>): CrmDataStore {
  const parsed = raw as CrmDataStore & {
    campaigns?: Array<Record<string, unknown>>;
    subscribers?: Array<Record<string, unknown>>;
    campaignAssets?: Array<Record<string, unknown>>;
    broadcasts?: Array<Record<string, unknown>>;
  };

  if (!parsed.broadcastMembers) parsed.broadcastMembers = [];
  if (!parsed.broadcastAssets) parsed.broadcastAssets = [];
  if (!parsed.broadcasts) parsed.broadcasts = [];

  const legacyCampaigns = parsed.campaigns ?? [];
  const legacySubs = parsed.subscribers ?? [];
  const legacyBroadcasts = (parsed.broadcasts ?? []) as Array<Record<string, unknown>>;

  if (legacyCampaigns.length > 0 || legacySubs.length > 0) {
    const nextBroadcasts: Broadcast[] = [];
    const nextMembers: BroadcastMember[] = [];

    for (const campaign of legacyCampaigns) {
      const campaignId = String(campaign.id ?? "");
      const sends = legacyBroadcasts.filter((b) => b.campaignId === campaignId);
      const subs = legacySubs.filter((s) => s.campaignId === campaignId);

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
                stats: { sent: 0, opened: 0, clicked: 0, failed: 0 },
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
          stats: (send.stats as Broadcast["stats"]) ?? { sent: 0, opened: 0, clicked: 0, failed: 0 },
          createdAt: String(send.createdAt ?? campaign.createdAt ?? new Date().toISOString()),
          updatedAt: String(send.updatedAt ?? campaign.updatedAt ?? new Date().toISOString()),
        });

        for (const sub of subs) {
          nextMembers.push({
            id: sends.length > 1 ? newId("member") : String(sub.id ?? newId("member")),
            accountLinkId: String(sub.accountLinkId ?? DEV_ACCOUNT_LINK_ID),
            broadcastId,
            audienceMemberId: (sub.audienceMemberId as string | null | undefined) ?? null,
            email: String(sub.email ?? ""),
            name: (sub.name as string | null | undefined) ?? null,
            status: mapLegacySubscriberStatus(String(sub.status ?? "subscribed")),
            source: (sub.source as BroadcastMember["source"]) ?? "audience_group",
            unsubscribeToken: String(sub.unsubscribeToken ?? newToken()),
            unsubscribedAt: (sub.unsubscribedAt as string | null | undefined) ?? null,
            bouncedAt: (sub.bouncedAt as string | null | undefined) ?? null,
            bounceReason: (sub.bounceReason as string | null | undefined) ?? null,
            createdAt: String(sub.createdAt ?? new Date().toISOString()),
            updatedAt: String(sub.updatedAt ?? new Date().toISOString()),
          });
        }
      }
    }

    parsed.broadcasts = nextBroadcasts;
    parsed.broadcastMembers = nextMembers;
    delete parsed.campaigns;
    delete parsed.subscribers;
  }

  for (const row of parsed.broadcasts as Array<Record<string, unknown>>) {
    if (row.campaignId && !row.audienceGroupId) {
      row.audienceGroupId = "";
    }
    if (!row.name) row.name = String(row.subject ?? "Untitled broadcast");
    if (!row.slug) row.slug = slugify(String(row.name)) || String(row.id).slice(0, 12);
    if (!row.listStatus) row.listStatus = "active";
    delete row.campaignId;
  }

  for (const row of parsed.broadcastMembers ?? []) {
    if (row.audienceMemberId === undefined) row.audienceMemberId = null;
    const status = row.status as string | undefined;
    if (status === "subscribed") row.status = "active";
  }

  for (const row of (parsed.recipients ?? []) as Array<Record<string, unknown>>) {
    if (row.subscriberId && !row.broadcastMemberId) {
      row.broadcastMemberId = row.subscriberId;
    }
    delete row.subscriberId;
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

  return parsed as CrmDataStore;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): CrmDataStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const store = migrateLegacyStore(parsed);
    for (const row of store.broadcasts) {
      if (!row.audienceGroupId) row.audienceGroupId = "";
    }
    for (const row of store.audienceGroups) {
      for (const contact of row.contacts) {
        if (!contact.sendStatus) contact.sendStatus = "active";
        if (contact.unsubscribedAt === undefined) contact.unsubscribedAt = null;
      }
    }
    for (const bm of store.broadcastMembers) {
      if (bm.status !== "unsubscribed" || !bm.audienceMemberId) continue;
      const broadcast = store.broadcasts.find((b) => b.id === bm.broadcastId);
      if (!broadcast?.audienceGroupId) continue;
      const group = store.audienceGroups.find((g) => g.id === broadcast.audienceGroupId);
      const contact = group?.contacts.find((c) => c.id === bm.audienceMemberId);
      if (contact && contact.sendStatus !== "unsubscribed") {
        contact.sendStatus = "unsubscribed";
        contact.unsubscribedAt = bm.unsubscribedAt ?? null;
      }
    }
    return store;
  } catch {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
}

function writeStore(store: CrmDataStore) {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

/** Synchronous JSON file store — dev environment; production D1 database to follow. */
export const store = {
  read(): CrmDataStore {
    return readStore();
  },
  update(mutator: (draft: CrmDataStore) => void): CrmDataStore {
    const draft = readStore();
    mutator(draft);
    writeStore(draft);
    return draft;
  },
  dataDir: DATA_DIR,
};
