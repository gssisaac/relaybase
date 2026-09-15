#!/usr/bin/env node
/**
 * Rebuild broadcast / recipient / tracking seed for sent + in-progress overviews.
 * Preserves account, templates, and audience groups.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, "../data/store.json");

const ENG = "audience_10425087-e030-4656-88cc-4872cc34d497";
const PRODUCT = "audience_bb00cf06-031e-49f2-b43d-aeecbb51eeb0";
const DOMAIN = "relaybase.email";

const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
const groups = raw.audienceGroups ?? [];
const engContacts = groups.find((g) => g.id === ENG)?.contacts ?? [];
const productContacts = groups.find((g) => g.id === PRODUCT)?.contacts ?? [];
const byId = new Map([...engContacts, ...productContacts].map((c) => [c.id, c]));

function contact(id) {
  const row = byId.get(id);
  if (!row) throw new Error(`missing contact ${id}`);
  return row;
}

function emptyStats() {
  return {
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
  };
}

function rollup(recipients, events) {
  const stats = emptyStats();
  stats.sent = recipients.filter((r) => r.status === "delivered" || r.status === "bounced").length;
  stats.delivered = recipients.filter((r) => r.status === "delivered").length;
  stats.bounced = recipients.filter((r) => r.status === "bounced").length;
  stats.failed = recipients.filter((r) => r.status === "failed").length;
  stats.skipped = recipients.filter((r) => r.status === "skipped").length;
  stats.opened = recipients.filter((r) => r.openedAt).length;
  stats.clicked = recipients.filter((r) => r.clickedAt).length;
  stats.totalOpens = recipients.reduce((n, r) => n + r.openCount, 0);
  stats.totalClicks = recipients.reduce((n, r) => n + r.clickCount, 0);
  stats.unsubscribed = recipients.filter((r) => r.unsubscribedAt).length;
  stats.complained = new Set(events.filter((e) => e.type === "complaint").map((e) => e.recipientId)).size;
  return stats;
}

function broadcast(partial) {
  return {
    accountLinkId: "dev",
    description: null,
    domain: DOMAIN,
    fromName: null,
    fromEmail: null,
    replyTo: null,
    defaultTemplateId: null,
    listStatus: "active",
    previewText: null,
    templateId: "tpl-minimal",
    scheduledAt: null,
    sentAt: null,
    startedAt: null,
    finishedAt: null,
    stats: emptyStats(),
    ...partial,
  };
}

const recipients = [];
const events = [];
let recipSeq = 0;
let eventSeq = 0;

function addRecipient(broadcastId, memberId, fields) {
  const member = contact(memberId);
  recipSeq += 1;
  const row = {
    id: `recipient_${broadcastId.slice(-8)}_${String(recipSeq).padStart(3, "0")}`,
    broadcastId,
    audienceMemberId: member.id,
    email: member.email,
    name: member.name,
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: fields.createdAt ?? fields.sentAt ?? fields.createdAt ?? new Date().toISOString(),
    ...fields,
  };
  recipients.push(row);
  return row;
}

function addEvent(broadcastId, recipient, type, occurredAt, extra = {}) {
  eventSeq += 1;
  events.push({
    id: `track_${broadcastId.slice(-8)}_${String(eventSeq).padStart(3, "0")}`,
    broadcastId,
    recipientId: recipient.id,
    memberEmail: recipient.email,
    type,
    url: extra.url ?? null,
    reason: extra.reason ?? null,
    occurredAt,
  });
}

function seedSentEngineering(broadcastId, startedAt, pattern) {
  const ids = [
    "member_eng_02",
    "member_eng_03",
    "member_eng_04",
    "member_eng_06",
    "member_eng_07",
    "member_eng_08",
    "member_eng_09",
    "member_eng_10",
    "member_eng_11",
    "member_eng_12",
  ];
  for (let i = 0; i < ids.length; i += 1) {
    const sentAt = new Date(new Date(startedAt).getTime() + i * 800).toISOString();
    const kind = pattern[i] ?? "delivered";
    if (kind === "skipped") {
      addRecipient(broadcastId, ids[i], { status: "skipped", createdAt: startedAt });
      continue;
    }
    if (kind === "bounced") {
      const r = addRecipient(broadcastId, ids[i], {
        status: "bounced",
        sentAt,
        bounceReason: "hard_bounce",
        errorMessage: "550 5.1.1 Recipient address rejected: User unknown",
        createdAt: startedAt,
      });
      addEvent(broadcastId, r, "bounce", sentAt, { reason: "hard_bounce" });
      continue;
    }
    if (kind === "failed") {
      addRecipient(broadcastId, ids[i], {
        status: "failed",
        errorMessage: "Worker timeout",
        createdAt: startedAt,
      });
      continue;
    }
    const deliveredAt = new Date(new Date(sentAt).getTime() + 2500).toISOString();
    const opened = kind === "open" || kind === "click" || kind === "unsub" || kind === "complaint";
    const clicked = kind === "click";
    const openedAt = opened
      ? new Date(new Date(deliveredAt).getTime() + (20 + i * 7) * 60_000).toISOString()
      : null;
    const clickedAt = clicked
      ? new Date(new Date(openedAt).getTime() + 90_000).toISOString()
      : null;
    const unsubscribedAt =
      kind === "unsub" ? new Date(new Date(openedAt).getTime() + 180_000).toISOString() : null;
    const r = addRecipient(broadcastId, ids[i], {
      status: "delivered",
      sentAt,
      deliveredAt,
      openedAt,
      clickedAt,
      unsubscribedAt,
      openCount: opened ? (kind === "click" ? 2 : 1) : 0,
      clickCount: clicked ? 1 : 0,
      createdAt: startedAt,
    });
    addEvent(broadcastId, r, "delivered", deliveredAt);
    if (openedAt) addEvent(broadcastId, r, "open", openedAt);
    if (clickedAt) {
      addEvent(broadcastId, r, "click", clickedAt, { url: pattern.link ?? "https://relaybase.com/blog/v2" });
    }
    if (unsubscribedAt) addEvent(broadcastId, r, "unsubscribe", unsubscribedAt, { reason: "Not interested" });
    if (kind === "complaint") {
      const when = new Date(new Date(openedAt).getTime() + 300_000).toISOString();
      addEvent(broadcastId, r, "complaint", when, { reason: "spam" });
    }
  }
}

function seedSentProduct(broadcastId, startedAt, { bounceEvery = 11, failAt = 18, skipAt = 22, openMod = 2, clickMod = 5, unsubAt = 7, links }) {
  for (let i = 0; i < productContacts.length; i += 1) {
    const member = productContacts[i];
    const sentAt = new Date(new Date(startedAt).getTime() + i * 600).toISOString();
    if (i === skipAt) {
      addRecipient(broadcastId, member.id, { status: "skipped", createdAt: startedAt });
      continue;
    }
    if (i % bounceEvery === 0 && i !== 0) {
      const r = addRecipient(broadcastId, member.id, {
        status: "bounced",
        sentAt,
        bounceReason: "hard_bounce",
        errorMessage: "550 mailbox unavailable",
        createdAt: startedAt,
      });
      addEvent(broadcastId, r, "bounce", sentAt, { reason: "hard_bounce" });
      continue;
    }
    if (i === failAt) {
      addRecipient(broadcastId, member.id, {
        status: "failed",
        errorMessage: "Rate limit exceeded",
        createdAt: startedAt,
      });
      continue;
    }
    const deliveredAt = new Date(new Date(sentAt).getTime() + 1800).toISOString();
    const opened = i % openMod === 0;
    const clicked = opened && i % clickMod === 0;
    const openedAt = opened
      ? new Date(new Date(deliveredAt).getTime() + (15 + (i % 8) * 11) * 60_000).toISOString()
      : null;
    const clickedAt = clicked ? new Date(new Date(openedAt).getTime() + 75_000).toISOString() : null;
    const unsubscribedAt =
      i === unsubAt && openedAt
        ? new Date(new Date(openedAt).getTime() + 240_000).toISOString()
        : null;
    const r = addRecipient(broadcastId, member.id, {
      status: "delivered",
      sentAt,
      deliveredAt,
      openedAt,
      clickedAt,
      unsubscribedAt,
      openCount: opened ? (clicked ? 2 : 1) : 0,
      clickCount: clicked ? 1 : 0,
      createdAt: startedAt,
    });
    addEvent(broadcastId, r, "delivered", deliveredAt);
    if (openedAt) addEvent(broadcastId, r, "open", openedAt);
    if (clickedAt) {
      const url = links[i % links.length];
      addEvent(broadcastId, r, "click", clickedAt, { url });
    }
    if (unsubscribedAt) addEvent(broadcastId, r, "unsubscribe", unsubscribedAt, { reason: "Too frequent" });
  }
}

const broadcasts = [];

const sepProduct = broadcast({
  id: "broadcast_d63712e3-2630-42fa-8706-04255e013a90",
  name: "September Product Update",
  slug: "september-product-update",
  audienceGroupId: ENG,
  subject: "Introducing Relaybase Scale v2.0",
  previewText: "New deliverability and stats for your broadcasts",
  bodyMarkdown:
    "Hello {{contact.name}},\n\nWe just shipped broadcast stats.\n\n[Read more](https://relaybase.com/blog/v2)\n",
  status: "sent",
  sentAt: "2026-09-15T09:00:00.000Z",
  startedAt: "2026-09-15T09:00:00.000Z",
  finishedAt: "2026-09-15T09:02:10.000Z",
  createdAt: "2026-09-14T21:57:32.495Z",
  updatedAt: "2026-09-15T09:02:10.000Z",
});
seedSentEngineering(sepProduct.id, sepProduct.startedAt, [
  "click",
  "open",
  "unsub",
  "delivered",
  "click",
  "bounced",
  "failed",
  "delivered",
  "open",
  "delivered",
]);
broadcasts.push(sepProduct);

const julyRecap = broadcast({
  id: "broadcast_sent_july_recap",
  name: "July Recap",
  slug: "july-recap",
  audienceGroupId: PRODUCT,
  subject: "What shipped in July",
  previewText: "A quieter month, a stronger foundation",
  bodyMarkdown: "Hello {{contact.name}},\n\nJuly recap is here.\n\n[See changelog](https://relaybase.com/changelog)\n",
  templateId: "tpl-card",
  status: "sent",
  sentAt: "2026-07-28T14:00:00.000Z",
  startedAt: "2026-07-28T14:00:00.000Z",
  finishedAt: "2026-07-28T14:08:00.000Z",
  createdAt: "2026-07-20T10:00:00.000Z",
  updatedAt: "2026-07-28T14:08:00.000Z",
});
seedSentProduct(julyRecap.id, julyRecap.startedAt, {
  links: ["https://relaybase.com/changelog", "https://relaybase.com/blog/july"],
});
broadcasts.push(julyRecap);

const augLaunch = broadcast({
  id: "broadcast_sent_aug_launch",
  name: "August Launch",
  slug: "august-launch",
  audienceGroupId: PRODUCT,
  subject: "Relaybase 2.0 is live",
  previewText: "CRM mode, audience groups, and broadcast stats",
  bodyMarkdown:
    "Hello {{contact.name}},\n\n[Launch notes](https://relaybase.com/blog/v2)\n\n[Watch demo](https://relaybase.com/demo)\n",
  templateId: "tpl-header-image",
  status: "sent",
  sentAt: "2026-08-12T16:30:00.000Z",
  startedAt: "2026-08-12T16:30:00.000Z",
  finishedAt: "2026-08-12T16:41:00.000Z",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-12T16:41:00.000Z",
});
seedSentProduct(augLaunch.id, augLaunch.startedAt, {
  bounceEvery: 12,
  failAt: 20,
  skipAt: 24,
  openMod: 2,
  clickMod: 4,
  unsubAt: 8,
  links: ["https://relaybase.com/blog/v2", "https://relaybase.com/demo"],
});
broadcasts.push(augLaunch);

const augSecurity = broadcast({
  id: "broadcast_sent_aug_security",
  name: "Mid-August Security Note",
  slug: "mid-august-security-note",
  audienceGroupId: ENG,
  subject: "Rotate your domain-scoped API keys",
  previewText: "A short security reminder from engineering",
  bodyMarkdown: "Hello {{contact.name}},\n\nPlease rotate keys this week.\n\n[Docs](https://relaybase.com/docs/keys)\n",
  status: "sent",
  sentAt: "2026-08-20T13:15:00.000Z",
  startedAt: "2026-08-20T13:15:00.000Z",
  finishedAt: "2026-08-20T13:16:40.000Z",
  createdAt: "2026-08-18T11:00:00.000Z",
  updatedAt: "2026-08-20T13:16:40.000Z",
});
seedSentEngineering(augSecurity.id, augSecurity.startedAt, [
  "open",
  "click",
  "delivered",
  "open",
  "delivered",
  "bounced",
  "delivered",
  "open",
  "complaint",
  "skipped",
]);
broadcasts.push(augSecurity);

const sepWelcome = broadcast({
  id: "broadcast_sent_sep_welcome",
  name: "September Welcome",
  slug: "september-welcome",
  audienceGroupId: PRODUCT,
  subject: "Welcome to the product list",
  previewText: "What to expect from Relaybase updates",
  bodyMarkdown: "Hello {{contact.name}},\n\n[Get started](https://relaybase.com/start)\n",
  status: "sent",
  sentAt: "2026-09-02T15:00:00.000Z",
  startedAt: "2026-09-02T15:00:00.000Z",
  finishedAt: "2026-09-02T15:09:20.000Z",
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-09-02T15:09:20.000Z",
});
seedSentProduct(sepWelcome.id, sepWelcome.startedAt, {
  bounceEvery: 13,
  failAt: 16,
  skipAt: 21,
  openMod: 3,
  clickMod: 6,
  unsubAt: 9,
  links: ["https://relaybase.com/start", "https://relaybase.com/blog/v2"],
});
broadcasts.push(sepWelcome);

const sepDigest = broadcast({
  id: "broadcast_sent_sep_digest",
  name: "Weekly Digest #36",
  slug: "weekly-digest-36",
  audienceGroupId: ENG,
  subject: "Digest #36 — queue drain and rollups",
  previewText: "What landed in the send pipeline this week",
  bodyMarkdown: "Hello {{contact.name}},\n\n[Read digest](https://relaybase.com/blog/digest-36)\n",
  status: "sent",
  sentAt: "2026-09-08T11:00:00.000Z",
  startedAt: "2026-09-08T11:00:00.000Z",
  finishedAt: "2026-09-08T11:01:50.000Z",
  createdAt: "2026-09-07T09:00:00.000Z",
  updatedAt: "2026-09-08T11:01:50.000Z",
});
seedSentEngineering(sepDigest.id, sepDigest.startedAt, [
  "click",
  "click",
  "open",
  "open",
  "delivered",
  "bounced",
  "failed",
  "open",
  "delivered",
  "unsub",
]);
broadcasts.push(sepDigest);

const failedSmtp = broadcast({
  id: "broadcast_failed_smtp",
  name: "Broken SMTP test",
  slug: "broken-smtp-test",
  audienceGroupId: ENG,
  subject: "Ignore — deliverability probe",
  previewText: "Internal probe",
  bodyMarkdown: "Probe body",
  status: "failed",
  sentAt: "2026-09-10T08:40:00.000Z",
  startedAt: "2026-09-10T08:40:00.000Z",
  finishedAt: "2026-09-10T08:40:22.000Z",
  createdAt: "2026-09-10T08:30:00.000Z",
  updatedAt: "2026-09-10T08:40:22.000Z",
});
for (const id of ["member_eng_02", "member_eng_06", "member_eng_07", "member_eng_09"]) {
  addRecipient(failedSmtp.id, id, {
    status: "failed",
    errorMessage: "SMTP 421 service not available",
    createdAt: failedSmtp.startedAt,
  });
}
broadcasts.push(failedSmtp);

function seedSendingMix(broadcastId, startedAt, members, { delivered, sending, failed, skipped, queued }) {
  let offset = 0;
  const take = (count, status, extra) => {
    const slice = members.slice(offset, offset + count);
    offset += count;
    for (let i = 0; i < slice.length; i += 1) {
      const sentAt = new Date(new Date(startedAt).getTime() + (offset - count + i) * 1200).toISOString();
      const deliveredAt =
        status === "delivered" ? new Date(new Date(sentAt).getTime() + 2000).toISOString() : null;
      const r = addRecipient(broadcastId, slice[i].id, {
        status,
        sentAt: status === "queued" || status === "skipped" ? null : sentAt,
        deliveredAt,
        errorMessage: status === "failed" ? extra?.error ?? "Transient 503" : null,
        createdAt: startedAt,
      });
      if (status === "delivered") addEvent(broadcastId, r, "delivered", deliveredAt);
      if (status === "failed") {
        addEvent(broadcastId, r, "bounce", sentAt, { reason: extra?.reason ?? "soft_bounce" });
      }
    }
  };
  take(delivered, "delivered");
  take(sending, "sending");
  take(failed, "failed", { error: "Worker timeout", reason: "soft_bounce" });
  take(skipped, "skipped");
  take(queued, "queued");
}

const sendingDigest = broadcast({
  id: "broadcast_sending_demo_001",
  name: "Weekly Engineering Digest",
  slug: "weekly-engineering-digest",
  audienceGroupId: ENG,
  subject: "This week in platform engineering",
  previewText: "Deploy pipeline updates and Scale send progress",
  bodyMarkdown: "Hello {{contact.name}},\n\nHere is your weekly digest.\n",
  status: "sending",
  sentAt: "2026-09-15T11:30:00.000Z",
  startedAt: "2026-09-15T11:30:00.000Z",
  createdAt: "2026-09-15T10:00:00.000Z",
  updatedAt: "2026-09-15T11:35:00.000Z",
});
seedSendingMix(
  sendingDigest.id,
  sendingDigest.startedAt,
  engContacts.filter((c) =>
    ["member_eng_02", "member_eng_06", "member_eng_07", "member_eng_09", "member_eng_10", "member_eng_11", "member_eng_12"].includes(
      c.id,
    ),
  ),
  { delivered: 3, sending: 3, failed: 0, skipped: 0, queued: 1 },
);
broadcasts.push(sendingDigest);

const sendingWave = broadcast({
  id: "broadcast_sending_product_wave",
  name: "Product Launch Wave",
  slug: "product-launch-wave",
  audienceGroupId: PRODUCT,
  subject: "Wave 2 — onboarding checklist",
  previewText: "Three steps to get your first broadcast out",
  bodyMarkdown: "Hello {{contact.name}},\n\n[Checklist](https://relaybase.com/start)\n",
  templateId: "tpl-header-image",
  status: "sending",
  sentAt: "2026-09-15T12:05:00.000Z",
  startedAt: "2026-09-15T12:05:00.000Z",
  createdAt: "2026-09-15T11:00:00.000Z",
  updatedAt: "2026-09-15T12:18:00.000Z",
});
seedSendingMix(sendingWave.id, sendingWave.startedAt, productContacts, {
  delivered: 8,
  sending: 4,
  failed: 2,
  skipped: 1,
  queued: 10,
});
broadcasts.push(sendingWave);

const sendingPartner = broadcast({
  id: "broadcast_sending_partner",
  name: "Partner note",
  slug: "partner-note",
  audienceGroupId: PRODUCT,
  subject: "A note for design partners",
  previewText: "Early access follow-up",
  bodyMarkdown: "Hello {{contact.name}},\n\nThanks for being a design partner.\n",
  status: "sending",
  sentAt: "2026-09-15T12:40:00.000Z",
  startedAt: "2026-09-15T12:40:00.000Z",
  createdAt: "2026-09-15T12:20:00.000Z",
  updatedAt: "2026-09-15T12:41:00.000Z",
});
seedSendingMix(sendingPartner.id, sendingPartner.startedAt, productContacts.slice(0, 10), {
  delivered: 1,
  sending: 6,
  failed: 0,
  skipped: 0,
  queued: 3,
});
broadcasts.push(sendingPartner);

const scheduledAma = broadcast({
  id: "broadcast_scheduled_ama",
  name: "Thursday AMA invite",
  slug: "thursday-ama-invite",
  audienceGroupId: PRODUCT,
  subject: "Join Thursday's AMA",
  previewText: "Ask the team about Scale broadcasts",
  bodyMarkdown: "Hello {{contact.name}},\n\nSee you Thursday.\n",
  status: "scheduled",
  scheduledAt: "2026-09-18T16:00:00.000Z",
  createdAt: "2026-09-14T18:00:00.000Z",
  updatedAt: "2026-09-14T18:10:00.000Z",
});
broadcasts.push(scheduledAma);

broadcasts.push(
  broadcast({
    id: "broadcast_6335f85b-01f5-4ccb-a2c7-37980c32f53c",
    name: "News letter",
    slug: "news-letter",
    audienceGroupId: ENG,
    subject: "Hello",
    bodyMarkdown: "ffff\n",
    templateId: "tpl-header-image",
    status: "draft",
    createdAt: "2026-09-14T21:58:55.873Z",
    updatedAt: "2026-09-14T23:32:28.014Z",
  }),
);

broadcasts.push(
  broadcast({
    id: "broadcast_5ac032ef-d7d8-40c6-8486-665fa4f1ff88",
    name: "September Product Update (copy)",
    slug: "news-letter-copy",
    audienceGroupId: ENG,
    subject: "Introducing Relaybase Scale v2.0",
    previewText: "New deliverability and stats for your broadcasts",
    bodyMarkdown:
      "Hello {{contact.name}},\n\nWe just shipped broadcast stats.\n\n{{contact.email}}\n\n{{unsubscribe_url}}\n",
    status: "draft",
    createdAt: "2026-09-14T23:06:35.602Z",
    updatedAt: "2026-09-14T23:16:18.606Z",
  }),
);

for (const row of broadcasts) {
  const recips = recipients.filter((r) => r.broadcastId === row.id);
  const ev = events.filter((e) => e.broadcastId === row.id);
  if (row.status === "sent" || row.status === "failed" || row.status === "sending") {
    row.stats = rollup(recips, ev);
  }
}

const scheduledJobs = [
  {
    id: "job_scheduled_ama",
    accountLinkId: "dev",
    kind: "campaign",
    refId: scheduledAma.id,
    runAt: scheduledAma.scheduledAt,
    status: "pending",
    createdAt: scheduledAma.createdAt,
  },
];

const suppressions = [
  {
    id: "suppression_demo_01",
    accountLinkId: "dev",
    email: "sophie.laurent@relaybase.email",
    reason: "hard_bounce",
    audienceGroupId: ENG,
    sourceBroadcastId: sepProduct.id,
    createdAt: "2026-09-15T09:00:02.500Z",
  },
];

raw.broadcasts = broadcasts;
raw.recipients = recipients;
raw.trackingEvents = events;
raw.scheduledJobs = scheduledJobs;
raw.accountSuppressions = suppressions;
raw.broadcastAssets = raw.broadcastAssets ?? [];

fs.writeFileSync(STORE, `${JSON.stringify(raw, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      broadcasts: broadcasts.length,
      sent: broadcasts.filter((b) => b.status === "sent").length,
      sending: broadcasts.filter((b) => b.status === "sending").length,
      scheduled: broadcasts.filter((b) => b.status === "scheduled").length,
      failed: broadcasts.filter((b) => b.status === "failed").length,
      recipients: recipients.length,
      trackingEvents: events.length,
    },
    null,
    2,
  ),
);
