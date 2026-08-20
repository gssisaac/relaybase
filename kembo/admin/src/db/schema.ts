import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const productSettings = sqliteTable("product_settings", {
  serviceId: text("service_id").notNull(),
  filename: text("filename").notNull(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.serviceId, t.filename] }),
}));
