#!/usr/bin/env node
/**
 * Export `data/store.json` `templates[]` to `data/templates/*.yaml` and remove the array from store.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.STUDIO_DATA_DIR ?? path.join(__dirname, "../data");
const STORE = path.join(DATA_DIR, "store.json");
const TEMPLATES_DIR = process.env.STUDIO_TEMPLATES_DIR ?? path.join(DATA_DIR, "templates");

function writeTemplate(row) {
  const yaml = stringifyYaml(row, {
    lineWidth: 0,
    defaultKeyType: "PLAIN",
    defaultStringType: "BLOCK_LITERAL",
  });
  fs.writeFileSync(path.join(TEMPLATES_DIR, `${row.id}.yaml`), `${yaml}\n`, "utf8");
}

if (!fs.existsSync(STORE)) {
  console.error(`Missing ${STORE}`);
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE, "utf8"));
const templates = store.templates ?? [];

fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

let exported = 0;
for (const row of templates) {
  if (!row?.id) continue;
  writeTemplate(row);
  exported += 1;
}

delete store.templates;
fs.writeFileSync(STORE, `${JSON.stringify(store, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      exported,
      templatesDir: TEMPLATES_DIR,
      store: STORE,
    },
    null,
    2,
  ),
);
