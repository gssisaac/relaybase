import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

// --- Existing tables (migrated from kembo-accounts D1) ---

export const waitlist = sqliteTable("waitlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull(),
  source: text("source"),
  userAgent: text("user_agent"),
}, (t) => ({
  createdAtIdx: index("waitlist_created_at_idx").on(t.createdAt),
}));

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  emailVerifiedAt: text("email_verified_at"),
}, (t) => ({
  emailIdx: index("accounts_email_idx").on(t.email),
}));

export const accountWorkers = sqliteTable("account_workers", {
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  workerUrl: text("worker_url").notNull(),
  registeredAt: text("registered_at").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.accountId, t.workerUrl] }),
  accountIdx: index("account_workers_account_idx").on(t.accountId),
}));

export const accountRecovery = sqliteTable("account_recovery", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
}, (t) => ({
  accountIdx: index("account_recovery_account_idx").on(t.accountId),
}));

// --- New tables (replacing KV namespaces) ---

export const productSettings = sqliteTable("product_settings", {
  serviceId: text("service_id").notNull(),
  filename: text("filename").notNull(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.serviceId, t.filename] }),
}));

export const licenses = sqliteTable("licenses", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  createdAt: text("created_at").notNull(),
  active: integer("active").notNull(),
  tier: text("tier").notNull(),
  status: text("status").notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: text("current_period_end"),
  note: text("note"),
}, (t) => ({
  emailIdx: index("licenses_email_idx").on(t.email),
  customerIdx: index("licenses_customer_idx").on(t.stripeCustomerId),
}));
