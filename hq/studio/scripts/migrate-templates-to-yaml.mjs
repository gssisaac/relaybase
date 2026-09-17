#!/usr/bin/env node
/**
 * Export `data/store.json` `templates[]` to `data/templates/*.yaml` and remove the array from store.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { readStoreJson, writeStoreJson, resolveDataDir, legacyStoreFile } from "./store-json.mjs";

const DATA_DIR = resolveDataDir();
const CATALOG_DIR = path.join(DATA_DIR, "templates");
const MESSAGES_DIR = path.join(DATA_DIR, "messages");

function writeYamlRow(row, dir) {
  const yaml = stringifyYaml(row, {
    lineWidth: 0,
    defaultKeyType: "PLAIN",
    defaultStringType: "BLOCK_LITERAL",
  });
  fs.writeFileSync(path.join(dir, `${row.id}.yaml`), `${yaml}\n`, "utf8");
}

if (!fs.existsSync(legacyStoreFile(DATA_DIR)) && !fs.existsSync(path.join(DATA_DIR, "store", "layouts.json"))) {
  console.error(`Missing store data under ${DATA_DIR}`);
  process.exit(1);
}

const store = readStoreJson(DATA_DIR);
const templates = store.templates ?? [];

fs.mkdirSync(CATALOG_DIR, { recursive: true });
fs.mkdirSync(MESSAGES_DIR, { recursive: true });

let exported = 0;
for (const row of templates) {
  if (!row?.id) continue;
  const dir =
    row.isPreset === true || String(row.id).startsWith("msgtpl_preset_")
      ? CATALOG_DIR
      : MESSAGES_DIR;
  writeYamlRow(row, dir);
  exported += 1;
}

delete store.templates;
writeStoreJson(store, DATA_DIR);

console.log(
  JSON.stringify(
    {
      exported,
      catalogDir: CATALOG_DIR,
      messagesDir: MESSAGES_DIR,
      storeDir: path.join(DATA_DIR, "store"),
    },
    null,
    2,
  ),
);
