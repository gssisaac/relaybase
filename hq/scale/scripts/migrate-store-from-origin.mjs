#!/usr/bin/env node
/**
 * Rebuild data/store.json from data/store-origin.json for the Layout / Template / Campaign / Trigger model.
 *
 * - Legacy `templates[]` with htmlSource → `layouts[]`
 * - Legacy `broadcasts[]` → `campaigns[]` + per-row `templates[]` (message)
 * - Legacy `automations[]` → `triggers[]` + message templates
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = path.join(__dirname, "../data/store-origin.json");
const STORE = path.join(__dirname, "../data/store.json");

function msgtplId(ownerId) {
  return `msgtpl_${ownerId}`;
}

function isLayoutRow(row) {
  return typeof row.htmlSource === "string" && row.htmlSource.length > 0;
}

function messageFromOwner(row, ownerId, defaults = {}) {
  const layoutId =
    typeof row.templateId === "string" && row.templateId.startsWith("tpl-")
      ? row.templateId
      : "tpl-minimal";
  const now = row.updatedAt ?? row.createdAt ?? new Date().toISOString();
  return {
    id: msgtplId(ownerId),
    accountLinkId: row.accountLinkId ?? "dev",
    name: defaults.name ?? row.name ?? "Untitled message",
    subject: row.subject ?? "",
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown ?? "",
    layoutId,
    templateVariables: row.templateVariables ?? {},
    category: defaults.category ?? "marketing",
    isPreset: defaults.isPreset ?? false,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now,
  };
}

function migrateCampaign(row) {
  const message = messageFromOwner(row, row.id, { category: "marketing" });
  const campaign = {
    id: row.id,
    accountLinkId: row.accountLinkId ?? "dev",
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    audienceGroupId: row.audienceGroupId ?? "",
    domain: row.domain ?? "",
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    complianceIdentityId: row.complianceIdentityId ?? null,
    listStatus: row.listStatus ?? "active",
    status: row.status ?? "draft",
    scheduledAt: row.scheduledAt ?? null,
    sentAt: row.sentAt ?? null,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    targetFilter: row.targetFilter,
    stats: row.stats ?? {
      sent: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
      skipped: 0,
      complained: 0,
      opened: 0,
      totalOpens: 0,
      clicked: 0,
      totalClicks: 0,
      unsubscribed: 0,
    },
    templateId: message.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return { campaign, message };
}

function migrateTrigger(row) {
  const message = messageFromOwner(row, row.id, {
    category: row.purpose === "transactional" ? "transactional" : "marketing",
  });
  const source = row.source ?? row.trigger;
  const trigger = {
    id: row.id,
    accountLinkId: row.accountLinkId ?? "dev",
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    domain: row.domain,
    fromName: row.fromName ?? null,
    fromEmail: row.fromEmail ?? null,
    replyTo: row.replyTo ?? null,
    complianceIdentityId: row.complianceIdentityId ?? null,
    purpose: row.purpose ?? "transactional",
    listStatus: row.listStatus ?? "active",
    status: row.status ?? "draft",
    source,
    audienceGroupId: row.audienceGroupId ?? null,
    cooldownSeconds: row.cooldownSeconds ?? 86_400,
    applyMarketingSuppression: row.applyMarketingSuppression ?? row.purpose !== "transactional",
    templateId: message.id,
    stats: row.stats,
    lastTriggeredAt: row.lastTriggeredAt ?? null,
    lastSentAt: row.lastSentAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return { trigger, message };
}

function presetTemplates(now) {
  return [
    {
      id: "msgtpl_preset_product_update",
      accountLinkId: "dev",
      name: "Product update (starter)",
      subject: "What's new in {{vars.brand.organization_name}}",
      previewText: "A short release note your subscribers can skim in under a minute.",
      bodyMarkdown:
        "Hello {{contact.name}},\n\nWe shipped a few improvements this week:\n\n- **Feature one** — one sentence on the outcome.\n- **Feature two** — who it helps and how to turn it on.\n\n[Read the full changelog](https://relaybase.com/changelog)\n\nThanks for reading,\nThe team",
      layoutId: "tpl-minimal",
      templateVariables: {},
      category: "newsletter",
      isPreset: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msgtpl_preset_verify_email",
      accountLinkId: "dev",
      name: "Verify email (transactional)",
      subject: "Verify your email",
      previewText: "Confirm this address to finish creating your account",
      bodyMarkdown:
        "Hi {{contact.name}},\n\nConfirm this address to finish creating your account.\n\n[Verify email]({{trigger.verifyUrl}})\n\nIf you did not sign up, ignore this message.\n\n— Relaybase",
      layoutId: "tpl-minimal",
      templateVariables: {},
      category: "transactional",
      isPreset: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

const origin = JSON.parse(fs.readFileSync(ORIGIN, "utf8"));
const now = new Date().toISOString();

const layoutById = new Map();
for (const row of origin.templates ?? []) {
  if (!isLayoutRow(row)) continue;
  layoutById.set(row.id, {
    id: row.id,
    accountLinkId: row.accountLinkId ?? null,
    name: row.name,
    htmlSource: row.htmlSource,
    variablesSchema: row.variablesSchema ?? null,
    isBuiltin: row.isBuiltin ?? row.id.startsWith("tpl-"),
    derivedFromLayoutId: row.derivedFromLayoutId ?? null,
    createdAt: row.createdAt ?? now,
  });
}

const messagesById = new Map();
for (const preset of presetTemplates(now)) {
  messagesById.set(preset.id, preset);
}

const campaigns = [];
for (const row of origin.broadcasts ?? origin.campaigns ?? []) {
  const { campaign, message } = migrateCampaign(row);
  messagesById.set(message.id, message);
  campaigns.push(campaign);
}

const triggers = [];
for (const row of origin.automations ?? origin.triggers ?? []) {
  const { trigger, message } = migrateTrigger(row);
  messagesById.set(message.id, message);
  triggers.push(trigger);
}

const recipients = (origin.recipients ?? []).map((r) => ({
  ...r,
  campaignId: r.campaignId ?? r.broadcastId,
}));

const suppressions = (origin.accountSuppressions ?? []).map((s) => ({
  ...s,
  sourceCampaignId: s.sourceCampaignId ?? s.sourceBroadcastId ?? null,
}));

const scheduledJobs = (origin.scheduledJobs ?? []).map((j) => ({
  ...j,
  kind: j.kind === "broadcast" ? "campaign" : j.kind,
}));

const trackingEvents = (origin.trackingEvents ?? []).map((e) => ({
  ...e,
  campaignId: e.campaignId ?? e.broadcastId,
}));

const out = {
  account: origin.account,
  complianceIdentities: origin.complianceIdentities ?? [],
  layouts: [...layoutById.values()],
  templates: [...messagesById.values()],
  campaigns,
  recipients,
  triggers,
  triggerEvents: origin.triggerEvents ?? [],
  triggerSends: origin.triggerSends ?? [],
  triggerTrackingEvents: origin.triggerTrackingEvents ?? [],
  accountSuppressions: suppressions,
  pipelineCards: origin.pipelineCards ?? [],
  activities: origin.activities ?? [],
  scheduledJobs,
  trackingEvents,
  campaignAssets: origin.campaignAssets ?? origin.broadcastAssets ?? [],
  triggerAssets: origin.triggerAssets ?? [],
  templateAssets: origin.templateAssets ?? [],
  audienceGroups: origin.audienceGroups ?? [],
};

fs.writeFileSync(STORE, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      layouts: out.layouts.length,
      messageTemplates: out.templates.length,
      campaigns: out.campaigns.length,
      triggers: out.triggers.length,
      audienceGroups: out.audienceGroups.length,
    },
    null,
    2,
  ),
);
