import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * D1 in production (docs/features/crm-mode-v0.2.md §3); SQLite locally since
 * hq/crm is a plain Node server, not a Cloudflare Worker. Table shapes match
 * the spec's Drizzle draft — P0 tables only (sequences/quotes/webhooks are P1).
 */

export const accountsLink = sqliteTable("accounts_link", {
  id: text("id").primaryKey(),
  workerUrl: text("worker_url"),
  domain: text("domain"),
  createdAt: text("created_at").notNull(),
});

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    accountLinkId: text("account_link_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    status: text("status").notNull().default("lead"),
    source: text("source").notNull().default("manual"),
    tagsJson: text("tags_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    lastActivityAt: text("last_activity_at"),
    lastReplyAt: text("last_reply_at"),
    followupSnoozed: integer("followup_snoozed").notNull().default(0),
  },
  (t) => [uniqueIndex("contacts_account_email_idx").on(t.accountLinkId, t.email)],
);

export const pipelineCards = sqliteTable("pipeline_cards", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().unique(),
  stage: text("stage").notNull().default("lead"),
  note: text("note"),
  updatedAt: text("updated_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull(),
  type: text("type").notNull(),
  payloadJson: text("payload_json"),
  occurredAt: text("occurred_at").notNull(),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  accountLinkId: text("account_link_id"),
  name: text("name").notNull(),
  htmlSource: text("html_source").notNull(),
  isBuiltin: integer("is_builtin").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  accountLinkId: text("account_link_id").notNull(),
  subject: text("subject").notNull().default(""),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  templateId: text("template_id"),
  segmentJson: text("segment_json").notNull().default("{}"),
  status: text("status").notNull().default("draft"),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  statsJson: text("stats_json").notNull().default('{"sent":0,"opened":0,"clicked":0}'),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const scheduledJobs = sqliteTable("scheduled_jobs", {
  id: text("id").primaryKey(),
  accountLinkId: text("account_link_id").notNull(),
  kind: text("kind").notNull(),
  refId: text("ref_id").notNull(),
  runAt: text("run_at").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const trackingEvents = sqliteTable("tracking_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  contactId: text("contact_id").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  occurredAt: text("occurred_at").notNull(),
});
