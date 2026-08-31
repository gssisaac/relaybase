import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const productSettings = sqliteTable("product_settings", {
  serviceId: text("service_id").notNull(),
  filename: text("filename").notNull(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.serviceId, t.filename] }),
}));

export const betaInvites = sqliteTable("beta_invites", {
  uuid: text("uuid").primaryKey(),
  email: text("email").notNull().unique(),
  data: text("data").notNull(),
}, (t) => ({
  emailIdx: index("beta_invites_email_idx").on(t.email),
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
