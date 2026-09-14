#!/usr/bin/env node
/**
 * One-shot: drop broadcastMembers, move tokens to audience contacts, seed sent broadcast stats.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, "../data/store.json");

function token() {
  return crypto.randomBytes(32).toString("base64url");
}

const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
const legacyMembers = raw.broadcastMembers ?? [];

const tokenByContact = new Map();
for (const bm of legacyMembers) {
  if (bm.audienceMemberId && bm.unsubscribeToken) {
    tokenByContact.set(bm.audienceMemberId, bm.unsubscribeToken);
  }
}

for (const group of raw.audienceGroups ?? []) {
  for (const c of group.contacts ?? []) {
    const fromBm = legacyMembers.find((bm) => bm.audienceMemberId === c.id);
    if (fromBm?.unsubscribeToken) c.unsubscribeToken = fromBm.unsubscribeToken;
    else if (!c.unsubscribeToken) c.unsubscribeToken = tokenByContact.get(c.id) ?? token();

    if (fromBm?.status === "unsubscribed") {
      c.sendStatus = "unsubscribed";
      c.unsubscribedAt = fromBm.unsubscribedAt ?? c.unsubscribedAt;
    }
    if (fromBm?.status === "bounced") {
      c.sendStatus = "bounced";
      c.bouncedAt = fromBm.bouncedAt ?? null;
      c.bounceReason = fromBm.bounceReason ?? null;
    }
    if (c.bouncedAt === undefined) c.bouncedAt = null;
    if (c.bounceReason === undefined) c.bounceReason = null;
  }
}

delete raw.broadcastMembers;

const SENT_BROADCAST_ID = "broadcast_d63712e3-2630-42fa-8706-04255e013a90";
const sentAt = "2026-09-15T09:00:00.000Z";

const stats = {
  sent: 10,
  delivered: 8,
  bounced: 1,
  failed: 1,
  opened: 4,
  totalOpens: 6,
  clicked: 2,
  totalClicks: 3,
  unsubscribed: 1,
};

const recipients = [
  {
    id: "recipient_demo_01",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_02",
    email: "priya.kapoor@relaybase.email",
    name: "Priya Kapoor",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:01.000Z",
    deliveredAt: "2026-09-15T09:00:03.000Z",
    openedAt: "2026-09-15T09:15:22.000Z",
    clickedAt: "2026-09-15T09:16:05.000Z",
    unsubscribedAt: null,
    openCount: 3,
    clickCount: 2,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_02",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_03",
    email: "james.connor@relaybase.email",
    name: "James O'Connor",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:01.000Z",
    deliveredAt: "2026-09-15T09:00:04.000Z",
    openedAt: "2026-09-15T09:42:10.000Z",
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 1,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_03",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_04",
    email: "elena.vasquez@relaybase.email",
    name: "Elena Vasquez",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:01.000Z",
    deliveredAt: "2026-09-15T09:00:03.000Z",
    openedAt: "2026-09-15T10:05:00.000Z",
    clickedAt: null,
    unsubscribedAt: "2026-09-15T10:05:45.000Z",
    openCount: 1,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_04",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_06",
    email: "amara.okonkwo@relaybase.email",
    name: "Amara Okonkwo",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:02.000Z",
    deliveredAt: "2026-09-15T09:00:05.000Z",
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_05",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_07",
    email: "ryan.mitchell@relaybase.email",
    name: "Ryan Mitchell",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:02.000Z",
    deliveredAt: "2026-09-15T09:00:04.000Z",
    openedAt: "2026-09-15T09:22:00.000Z",
    clickedAt: "2026-09-15T09:23:10.000Z",
    unsubscribedAt: null,
    openCount: 1,
    clickCount: 1,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_06",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_08",
    email: "sophie.laurent@relaybase.email",
    name: "Sophie Laurent",
    status: "bounced",
    errorMessage: "550 5.1.1 Recipient address rejected: User unknown",
    bounceReason: "hard_bounce",
    sentAt: "2026-09-15T09:00:02.000Z",
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_07",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_09",
    email: "noah.bergstrom@relaybase.email",
    name: "Noah Bergstrom",
    status: "failed",
    errorMessage: "Worker timeout",
    bounceReason: null,
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_08",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_10",
    email: "hannah.reeves@relaybase.email",
    name: "Hannah Reeves",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:02.000Z",
    deliveredAt: "2026-09-15T09:00:06.000Z",
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_09",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_11",
    email: "tyler.brooks@relaybase.email",
    name: "Tyler Brooks",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:03.000Z",
    deliveredAt: "2026-09-15T09:00:07.000Z",
    openedAt: "2026-09-15T11:10:00.000Z",
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 1,
    clickCount: 0,
    createdAt: sentAt,
  },
  {
    id: "recipient_demo_10",
    broadcastId: SENT_BROADCAST_ID,
    audienceMemberId: "member_eng_12",
    email: "mei.lin@relaybase.email",
    name: "Mei Lin",
    status: "delivered",
    errorMessage: null,
    bounceReason: null,
    sentAt: "2026-09-15T09:00:03.000Z",
    deliveredAt: "2026-09-15T09:00:08.000Z",
    openedAt: null,
    clickedAt: null,
    unsubscribedAt: null,
    openCount: 0,
    clickCount: 0,
    createdAt: sentAt,
  },
];

const trackingEvents = [
  {
    id: "track_demo_01",
    broadcastId: SENT_BROADCAST_ID,
    recipientId: "recipient_demo_01",
    memberEmail: "priya.kapoor@relaybase.email",
    type: "open",
    url: null,
    reason: null,
    occurredAt: "2026-09-15T09:15:22.000Z",
  },
  {
    id: "track_demo_02",
    broadcastId: SENT_BROADCAST_ID,
    recipientId: "recipient_demo_01",
    memberEmail: "priya.kapoor@relaybase.email",
    type: "click",
    url: "https://relaybase.com/blog/v2",
    reason: null,
    occurredAt: "2026-09-15T09:16:05.000Z",
  },
  {
    id: "track_demo_03",
    broadcastId: SENT_BROADCAST_ID,
    recipientId: "recipient_demo_03",
    memberEmail: "elena.vasquez@relaybase.email",
    type: "unsubscribe",
    url: null,
    reason: "Not interested",
    occurredAt: "2026-09-15T10:05:45.000Z",
  },
  {
    id: "track_demo_04",
    broadcastId: SENT_BROADCAST_ID,
    recipientId: "recipient_demo_06",
    memberEmail: "sophie.laurent@relaybase.email",
    type: "bounce",
    url: null,
    reason: "hard_bounce",
    occurredAt: "2026-09-15T09:00:02.500Z",
  },
];

for (const b of raw.broadcasts ?? []) {
  if (b.stats?.opened !== undefined && b.stats.delivered === undefined) {
    b.stats = {
      sent: b.stats.sent ?? 0,
      delivered: 0,
      bounced: 0,
      failed: b.stats.failed ?? 0,
      opened: b.stats.opened ?? 0,
      totalOpens: b.stats.opened ?? 0,
      clicked: b.stats.clicked ?? 0,
      totalClicks: b.stats.clicked ?? 0,
      unsubscribed: 0,
    };
  }
}

const sentIdx = (raw.broadcasts ?? []).findIndex((b) => b.id === SENT_BROADCAST_ID);
if (sentIdx >= 0) {
  raw.broadcasts[sentIdx] = {
    ...raw.broadcasts[sentIdx],
    name: "September Product Update",
    subject: "Introducing Relaybase CRM v2.0",
    previewText: "New deliverability and stats for your broadcasts",
    bodyMarkdown: "Hello {{contact.name}},\n\nWe just shipped broadcast stats.\n\n[Read more](https://relaybase.com/blog/v2)\n",
    status: "sent",
    sentAt,
    stats,
    updatedAt: "2026-09-15T12:00:00.000Z",
  };
}

raw.recipients = recipients;
raw.trackingEvents = trackingEvents;
raw.accountSuppressions = [
  {
    id: "suppression_demo_01",
    accountLinkId: "dev",
    email: "sophie.laurent@relaybase.email",
    reason: "hard_bounce",
    createdAt: "2026-09-15T09:00:02.500Z",
  },
];

// Post-send: Elena unsubscribed from this send
const engGroup = (raw.audienceGroups ?? []).find(
  (g) => g.id === "audience_10425087-e030-4656-88cc-4872cc34d497",
);
if (engGroup) {
  const elena = engGroup.contacts.find((c) => c.id === "member_eng_04");
  if (elena) {
    elena.sendStatus = "unsubscribed";
    elena.unsubscribedAt = "2026-09-15T10:05:45.000Z";
  }
  const sophie = engGroup.contacts.find((c) => c.id === "member_eng_08");
  if (sophie) {
    sophie.sendStatus = "bounced";
    sophie.bouncedAt = "2026-09-15T09:00:02.500Z";
    sophie.bounceReason = "hard_bounce";
  }
}

delete raw.campaignAssets;

fs.writeFileSync(STORE, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
console.log("Migrated store.json — broadcastMembers removed, sent broadcast seeded.");
