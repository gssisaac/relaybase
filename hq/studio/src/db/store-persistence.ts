import fs from "node:fs";
import path from "node:path";

import type { StudioDataStore } from "./types";

/** Primary dev store shards (one JSON file per key under `data/store/`). */
export const STORE_SHARD_KEYS = [
  "account",
  "complianceIdentities",
  "layouts",
  "newsletters",
  "triggers",
  "triggerEvents",
  "triggerSends",
  "scheduledJobs",
  "subscriberGroups",
] as const satisfies readonly (keyof StudioDataStore)[];

/** Additional persisted collections (same `data/store/` directory). */
export const STORE_AUX_SHARD_KEYS = [
  "recipients",
  "triggerTrackingEvents",
  "accountSuppressions",
  "pipelineCards",
  "activities",
  "trackingEvents",
  "newsletterAssets",
  "triggerAssets",
  "messageAssets",
] as const satisfies readonly (keyof StudioDataStore)[];

export const PERSISTED_STORE_KEYS = [...STORE_SHARD_KEYS, ...STORE_AUX_SHARD_KEYS] as const;

export type PersistedStoreKey = (typeof PERSISTED_STORE_KEYS)[number];

export function storeDir(dataDir: string) {
  return path.join(dataDir, "store");
}

export function legacyStoreFile(dataDir: string) {
  return path.join(dataDir, "store.json");
}

function shardPath(dataDir: string, key: PersistedStoreKey) {
  return path.join(storeDir(dataDir), `${key}.json`);
}

function legacyAudienceGroupsShard(dataDir: string) {
  return path.join(storeDir(dataDir), "audienceGroups.json");
}

function writeShard(dataDir: string, key: PersistedStoreKey, value: unknown) {
  fs.writeFileSync(shardPath(dataDir, key), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function removeShard(dataDir: string, key: PersistedStoreKey) {
  const file = shardPath(dataDir, key);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function isEmptyAuxShard(key: PersistedStoreKey, value: unknown): boolean {
  if (!(STORE_AUX_SHARD_KEYS as readonly string[]).includes(key)) return false;
  return Array.isArray(value) && value.length === 0;
}

export function ensureStoreDir(dataDir: string) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(storeDir(dataDir), { recursive: true });
}

export function migrateLegacyMonolithStore(dataDir: string): boolean {
  const legacy = legacyStoreFile(dataDir);
  if (!fs.existsSync(legacy)) return false;

  const parsed = JSON.parse(fs.readFileSync(legacy, "utf8")) as Record<string, unknown>;
  if (parsed.audienceGroups !== undefined && parsed.subscriberGroups === undefined) {
    parsed.subscriberGroups = parsed.audienceGroups;
    delete parsed.audienceGroups;
  }
  ensureStoreDir(dataDir);
  for (const key of PERSISTED_STORE_KEYS) {
    if (parsed[key] === undefined) continue;
    writeShard(dataDir, key, parsed[key]);
  }
  fs.unlinkSync(legacy);
  return true;
}

export function readPersistedStoreShards(
  dataDir: string,
): Partial<StudioDataStore> & { templates?: StudioDataStore["templates"] } {
  ensureStoreDir(dataDir);
  migrateLegacyMonolithStore(dataDir);

  const out: Partial<StudioDataStore> = {};
  let found = false;

  for (const key of PERSISTED_STORE_KEYS) {
    const file = shardPath(dataDir, key);
    if (!fs.existsSync(file)) continue;
    found = true;
    out[key] = JSON.parse(fs.readFileSync(file, "utf8")) as never;
  }

  if (out.subscriberGroups === undefined) {
    const legacyAudience = legacyAudienceGroupsShard(dataDir);
    if (fs.existsSync(legacyAudience)) {
      found = true;
      out.subscriberGroups = JSON.parse(fs.readFileSync(legacyAudience, "utf8")) as never;
    }
  }

  if (!found) return out;
  return out;
}

export function hasPersistedStore(dataDir: string): boolean {
  if (fs.existsSync(legacyStoreFile(dataDir))) return true;
  for (const key of PERSISTED_STORE_KEYS) {
    if (fs.existsSync(shardPath(dataDir, key))) return true;
  }
  if (fs.existsSync(legacyAudienceGroupsShard(dataDir))) return true;
  return false;
}

export function writePersistedStoreShards(
  dataDir: string,
  store: Omit<StudioDataStore, "templates" | "messages">,
) {
  ensureStoreDir(dataDir);
  const legacyAudience = legacyAudienceGroupsShard(dataDir);
  if (fs.existsSync(legacyAudience)) fs.unlinkSync(legacyAudience);
  for (const key of PERSISTED_STORE_KEYS) {
    const value = store[key];
    if (isEmptyAuxShard(key, value)) {
      removeShard(dataDir, key);
      continue;
    }
    writeShard(dataDir, key, value);
  }
}
