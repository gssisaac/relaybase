/**
 * Dev-only: apply TypeORM `synchronize` to PostgreSQL from entity metadata.
 *
 * Usage: DATABASE_URL=postgres://... TYPEORM_SYNC=1 pnpm run orm:sync
 */
import "reflect-metadata";

import { createStudioDataSource, destroyStudioDataSource } from "@lib/orm/data-source";

async function main() {
  if (process.env.TYPEORM_SYNC !== "1") {
    console.error("Refusing to sync without TYPEORM_SYNC=1 (dev only).");
    process.exit(1);
  }

  const dataSource = createStudioDataSource();
  await dataSource.initialize();
  console.log("[orm:sync] Schema synchronized from entities.");
  await destroyStudioDataSource();
}

main().catch((err) => {
  console.error("[orm:sync] Failed:", err);
  process.exit(1);
});
