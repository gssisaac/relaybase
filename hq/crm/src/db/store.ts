import fs from "node:fs";
import path from "node:path";

import { BUILTIN_TEMPLATES } from "../lib/builtin-templates";
import type { CrmDataStore } from "./types";

/** Single-account dev stand-in for real HQ ops login (§1.3 auth). */
export const DEV_ACCOUNT_LINK_ID = "dev";

const DATA_DIR = process.env.CRM_DATA_DIR ?? path.join(process.cwd(), "data");

const STORE_FILE = path.join(DATA_DIR, "store.json");

function defaultStore(): CrmDataStore {
  const now = new Date().toISOString();
  return {
    account: {
      id: DEV_ACCOUNT_LINK_ID,
      workerUrl: null,
      domain: null,
      createdAt: now,
    },
    audienceGroups: [],
    pipelineCards: [],
    activities: [],
    templates: BUILTIN_TEMPLATES.map((tpl) => ({
      id: tpl.id,
      accountLinkId: null,
      name: tpl.name,
      htmlSource: tpl.htmlSource,
      isBuiltin: true,
      createdAt: now,
    })),
    campaigns: [],
    scheduledJobs: [],
    trackingEvents: [],
    campaignAssets: [],
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore(): CrmDataStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as CrmDataStore;
    if (!parsed.campaignAssets) parsed.campaignAssets = [];
    if (!parsed.audienceGroups) parsed.audienceGroups = [];
    return parsed;
  } catch {
    const initial = defaultStore();
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
    return initial;
  }
}

function writeStore(store: CrmDataStore) {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

/** Synchronous JSON file store — fine for local dev; replace with D1 in production. */
export const store = {
  read(): CrmDataStore {
    return readStore();
  },
  update(mutator: (draft: CrmDataStore) => void): CrmDataStore {
    const draft = readStore();
    mutator(draft);
    writeStore(draft);
    return draft;
  },
  dataDir: DATA_DIR,
};
