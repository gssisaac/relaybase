/**
 * Embedded D1 migrations — the Worker owns its own schema.
 *
 * SQL files live next to each D1 module:
 *   db/app/migrations/*.sql
 *   db/log/migrations/*.sql
 *   db/inbox-index/migrations/*.sql
 *
 * The desktop creates the D1 databases and deploys the Worker, then calls
 * POST /console/init-db. The Worker applies these strings. Desktop never
 * runs wrangler d1 migrations apply or raw SQL.
 *
 * To add a migration: add the .sql file under the matching db module, then
 * add the file content as a string below so the Worker and wrangler stay
 * in sync.
 */

export type MigrationTarget = "app" | "logs" | "inbox";

export type Migration = {
  target: MigrationTarget;
  name: string;
  sql: string;
};

const APP_0000 = `CREATE TABLE \`domains\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`created_at\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`domains_domain_unique\` ON \`domains\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`addresses\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`email\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`display_name\` text,
	\`signature\` text,
	\`inbound_enabled\` integer DEFAULT 1 NOT NULL,
	\`mobile_enabled\` integer DEFAULT 1 NOT NULL,
	\`created_at\` text NOT NULL,
	FOREIGN KEY (\`domain\`) REFERENCES \`domains\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`addresses_email_unique\` ON \`addresses\` (\`email\`);
--> statement-breakpoint
CREATE INDEX \`addresses_domain_idx\` ON \`addresses\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`api_keys\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`key_hash\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`label\` text,
	\`key_prefix\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`active\` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`api_keys_key_hash_unique\` ON \`api_keys\` (\`key_hash\`);
--> statement-breakpoint
CREATE INDEX \`api_keys_domain_idx\` ON \`api_keys\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`api_keys_active_idx\` ON \`api_keys\` (\`active\`);
--> statement-breakpoint
CREATE TABLE \`audience_groups\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`default_from\` text,
	\`data_source_json\` text,
	\`cron_enabled\` integer DEFAULT 0 NOT NULL,
	\`cron_interval_minutes\` integer,
	\`last_sync_at\` text,
	\`last_sync_status\` text,
	\`last_sync_error\` text,
	\`last_sync_count\` integer,
	\`sync_progress_json\` text,
	\`sync_history_json\` text
);
--> statement-breakpoint
CREATE INDEX \`audience_groups_domain_idx\` ON \`audience_groups\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`audience_contacts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`email\` text NOT NULL,
	\`name\` text,
	\`domain\` text NOT NULL,
	\`group_id\` text NOT NULL,
	\`source\` text NOT NULL,
	\`added_at\` text NOT NULL,
	FOREIGN KEY (\`group_id\`) REFERENCES \`audience_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`audience_contacts_group_email_idx\` ON \`audience_contacts\` (\`group_id\`,\`email\`);
--> statement-breakpoint
CREATE INDEX \`audience_contacts_group_idx\` ON \`audience_contacts\` (\`group_id\`);
--> statement-breakpoint
CREATE INDEX \`audience_contacts_domain_idx\` ON \`audience_contacts\` (\`domain\`);
--> statement-breakpoint
CREATE TABLE \`auth_tokens\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`token_hash\` text NOT NULL,
	\`label\` text,
	\`product_id\` text,
	\`token_prefix\` text NOT NULL,
	\`created_at\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`auth_tokens_token_hash_unique\` ON \`auth_tokens\` (\`token_hash\`);
--> statement-breakpoint
CREATE TABLE \`broadcasts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`subject\` text NOT NULL,
	\`status\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`domain\` text NOT NULL,
	\`group_ids_json\` text NOT NULL,
	\`from_addr\` text,
	\`body\` text,
	\`recipient_count\` integer,
	\`sent_at\` text,
	\`send_progress_json\` text,
	\`send_history_json\` text
);
--> statement-breakpoint
CREATE INDEX \`broadcasts_domain_idx\` ON \`broadcasts\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`broadcasts_status_idx\` ON \`broadcasts\` (\`status\`);
--> statement-breakpoint
CREATE INDEX \`broadcasts_created_at_idx\` ON \`broadcasts\` (\`created_at\`);
--> statement-breakpoint
CREATE TABLE \`domain_branding\` (
	\`domain\` text PRIMARY KEY NOT NULL,
	\`dmarc_policy\` text DEFAULT 'quarantine' NOT NULL,
	\`dmarc_rua\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`inbound_events\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`event_type\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`payload_json\` text NOT NULL,
	\`expires_at\` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`inbound_events_domain_idx\` ON \`inbound_events\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`inbound_events_expires_idx\` ON \`inbound_events\` (\`expires_at\`);
--> statement-breakpoint
CREATE TABLE \`mobile_passwords\` (
	\`email\` text PRIMARY KEY NOT NULL,
	\`password_hash\` text NOT NULL,
	\`salt\` text NOT NULL,
	\`updated_at\` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`owner_config\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`owner_email\` text,
	\`worker_url\` text
);
--> statement-breakpoint
CREATE TABLE \`webhooks\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`domain\` text NOT NULL,
	\`url\` text NOT NULL,
	\`secret_hash\` text NOT NULL,
	\`created_at\` text NOT NULL,
	\`active\` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`webhooks_domain_idx\` ON \`webhooks\` (\`domain\`);
--> statement-breakpoint
CREATE INDEX \`webhooks_active_idx\` ON \`webhooks\` (\`active\`);
--> statement-breakpoint
CREATE TABLE \`webhook_fails\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`webhook_id\` text NOT NULL,
	\`event_id\` text NOT NULL,
	\`url\` text NOT NULL,
	\`failed_at\` text NOT NULL,
	\`expires_at\` text NOT NULL,
	FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`webhook_fails_webhook_idx\` ON \`webhook_fails\` (\`webhook_id\`);
--> statement-breakpoint
CREATE INDEX \`webhook_fails_expires_idx\` ON \`webhook_fails\` (\`expires_at\`);
--> statement-breakpoint
CREATE TABLE \`webhook_secrets\` (
	\`webhook_id\` text PRIMARY KEY NOT NULL,
	\`secret\` text NOT NULL,
	FOREIGN KEY (\`webhook_id\`) REFERENCES \`webhooks\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`;

const APP_0001 = `ALTER TABLE \`owner_config\` ADD \`admin_token\` text;`;

const LOGS_0001 = `CREATE TABLE IF NOT EXISTS ops_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  ok INTEGER NOT NULL,
  status INTEGER,
  source TEXT,
  domain TEXT,
  from_addr TEXT,
  to_addr TEXT,
  subject TEXT,
  message_id TEXT,
  error TEXT,
  key_id TEXT,
  key_prefix TEXT,
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS ops_log_at_idx ON ops_log (at DESC);
CREATE INDEX IF NOT EXISTS ops_log_ok_idx ON ops_log (ok, at DESC);
CREATE INDEX IF NOT EXISTS ops_log_domain_idx ON ops_log (domain);
CREATE INDEX IF NOT EXISTS ops_log_kind_idx ON ops_log (kind, at DESC);`;

const INBOX_0001 = `CREATE VIRTUAL TABLE IF NOT EXISTS inbound_search_fts USING fts5(
  id UNINDEXED,
  domain UNINDEXED,
  subject,
  from_email,
  from_name,
  to_email UNINDEXED,
  to_emails,
  cc_emails,
  recipients UNINDEXED,
  body_text,
  body_preview UNINDEXED,
  received_at UNINDEXED,
  message_id UNINDEXED,
  in_reply_to UNINDEXED,
  refs UNINDEXED,
  size UNINDEXED,
  attachment_count UNINDEXED,
  read_at UNINDEXED
);`;

export const MIGRATIONS: Migration[] = [
  { target: "app", name: "0000_old_pandemic", sql: APP_0000 },
  { target: "app", name: "0001_owner_admin_token", sql: APP_0001 },
  { target: "logs", name: "0001_ops_logs", sql: LOGS_0001 },
  { target: "inbox", name: "0001_create_inbound_search", sql: INBOX_0001 },
];

/** Split a Drizzle migration on `--> statement-breakpoint` into statements. */
export function splitMigrationSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isCommentOnly(part));
}

function isCommentOnly(sql: string): boolean {
  return sql
    .split("\n")
    .every((line) => line.trim() === "" || line.trim().startsWith("--"));
}
