#!/usr/bin/env node
/**
 * Read/write Studio dev store as `data/store/*.json` shards (legacy `data/store.json` is migrated once).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const STORE_SHARD_KEYS = [
  "account",
  "complianceIdentities",
  "layouts",
  "newsletters",
  "triggers",
  "triggerEvents",
  "triggerSends",
  "scheduledJobs",
  "audienceGroups",
];

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
];

export const PERSISTED_STORE_KEYS = [...STORE_SHARD_KEYS, ...STORE_AUX_SHARD_KEYS];

export function resolveDataDir() {
  return process.env.STUDIO_DATA_DIR ?? path.join(__dirname, "../data");
}

export function storeDir(dataDir = resolveDataDir()) {
  return path.join(dataDir, "store");
}

export function legacyStoreFile(dataDir = resolveDataDir()) {
  return path.join(dataDir, "store.json");
}

function shardPath(dataDir, key) {
  return path.join(storeDir(dataDir), `${key}.json`);
}

function ensureStoreDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(storeDir(dataDir), { recursive: true });
}

export function migrateLegacyMonolithStore(dataDir = resolveDataDir()) {
  const legacy = legacyStoreFile(dataDir);
  if (!fs.existsSync(legacy)) return false;

  const parsed = JSON.parse(fs.readFileSync(legacy, "utf8"));
  ensureStoreDir(dataDir);
  for (const key of PERSISTED_STORE_KEYS) {
    if (parsed[key] === undefined) continue;
    fs.writeFileSync(shardPath(dataDir, key), `${JSON.stringify(parsed[key], null, 2)}\n`, "utf8");
  }
  fs.unlinkSync(legacy);
  return true;
}

export function readStoreJson(dataDir = resolveDataDir()) {
  ensureStoreDir(dataDir);
  migrateLegacyMonolithStore(dataDir);

  const out = {};
  for (const key of PERSISTED_STORE_KEYS) {
    const file = shardPath(dataDir, key);
    if (!fs.existsSync(file)) continue;
    out[key] = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return out;
}

export function writeStoreJson(data, dataDir = resolveDataDir()) {
  ensureStoreDir(dataDir);
  for (const key of PERSISTED_STORE_KEYS) {
    if (data[key] === undefined) continue;
    const value = data[key];
    if (STORE_AUX_SHARD_KEYS.includes(key) && Array.isArray(value) && value.length === 0) {
      const file = shardPath(dataDir, key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      continue;
    }
    fs.writeFileSync(shardPath(dataDir, key), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
