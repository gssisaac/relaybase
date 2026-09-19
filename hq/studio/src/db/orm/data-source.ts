import "reflect-metadata";
import { DataSource } from "typeorm";

import { studioOrmEntities } from "./entities/index";
import { postgresSslForUrl } from "./postgres-client-config";

export function readDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function isPostgresStoreEnabled(): boolean {
  return readDatabaseUrl() !== undefined;
}

export function createStudioDataSource(): DataSource {
  const url = readDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is required for PostgreSQL storage");
  }

  const synchronize = process.env.TYPEORM_SYNC === "1";
  return new DataSource({
    type: "postgres",
    url,
    ssl: postgresSslForUrl(url),
    entities: [...studioOrmEntities],
    synchronize,
    logging: process.env.TYPEORM_LOGGING === "1",
  });
}

/** Singleton used after `initStudioDataSource()`. */
let appDataSource: DataSource | null = null;

export function getStudioDataSource(): DataSource {
  if (!appDataSource) {
    throw new Error("Studio DataSource is not initialized. Call initStudioDataSource() first.");
  }
  return appDataSource;
}

export async function initStudioDataSource(): Promise<DataSource | null> {
  if (!isPostgresStoreEnabled()) return null;
  if (appDataSource?.isInitialized) return appDataSource;

  appDataSource = createStudioDataSource();
  await appDataSource.initialize();
  return appDataSource;
}

export async function destroyStudioDataSource(): Promise<void> {
  if (appDataSource?.isInitialized) {
    await appDataSource.destroy();
  }
  appDataSource = null;
}
