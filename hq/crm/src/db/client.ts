import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { BUILTIN_TEMPLATES } from "../lib/builtin-templates";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DB_PATH = process.env.CRM_DB_PATH ?? "./crm.dev.sqlite3";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS accounts_link (
  id TEXT PRIMARY KEY,
  worker_url TEXT,
  domain TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  account_link_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  source TEXT NOT NULL DEFAULT 'manual',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_activity_at TEXT,
  last_reply_at TEXT,
  followup_snoozed INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_account_email_idx ON contacts(account_link_id, email);

CREATE TABLE IF NOT EXISTS pipeline_cards (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL DEFAULT 'lead',
  note TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  account_link_id TEXT,
  name TEXT NOT NULL,
  html_source TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  account_link_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  template_id TEXT,
  segment_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  sent_at TEXT,
  stats_json TEXT NOT NULL DEFAULT '{"sent":0,"opened":0,"clicked":0}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,
  account_link_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  run_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  occurred_at TEXT NOT NULL
);
`);

export const db = drizzle(sqlite, { schema });

function seedDevAccount() {
  const existing = sqlite
    .prepare("SELECT id FROM accounts_link WHERE id = ?")
    .get(DEV_ACCOUNT_LINK_ID);
  if (existing) return;
  sqlite
    .prepare(
      "INSERT INTO accounts_link (id, worker_url, domain, created_at) VALUES (?, NULL, NULL, ?)",
    )
    .run(DEV_ACCOUNT_LINK_ID, new Date().toISOString());
}

function seedBuiltinTemplates() {
  const count = sqlite
    .prepare("SELECT COUNT(*) as n FROM templates WHERE is_builtin = 1")
    .get() as { n: number };
  if (count.n > 0) return;
  const insert = sqlite.prepare(
    "INSERT INTO templates (id, account_link_id, name, html_source, is_builtin, created_at) VALUES (?, NULL, ?, ?, 1, ?)",
  );
  const now = new Date().toISOString();
  for (const tpl of BUILTIN_TEMPLATES) {
    insert.run(tpl.id, tpl.name, tpl.htmlSource, now);
  }
}

seedDevAccount();
seedBuiltinTemplates();
