import nodeFs from "node:fs";
import path from "node:path";

import type { Template } from "../../db/types";
import { parseCatalogYaml } from "./parse-catalog-yaml";

export function resolveCommittedCatalogDir(): string {
  if (process.env.STUDIO_BUILTIN_CATALOG_DIR) {
    return path.resolve(process.env.STUDIO_BUILTIN_CATALOG_DIR);
  }
  return path.join(process.cwd(), "catalog", "templates");
}

function loadFromCommittedDir(): Template[] {
  const dir = resolveCommittedCatalogDir();
  if (!nodeFs.existsSync(dir)) {
    console.warn(`[studio] committed catalog dir missing: ${dir}`);
    return [];
  }

  const files = nodeFs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));

  const templates: Template[] = [];
  for (const file of files) {
    const source = nodeFs.readFileSync(path.join(dir, file), "utf8");
    const row = parseCatalogYaml(source);
    if (row) templates.push(row);
  }
  templates.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return templates;
}

/** Set by `worker.ts` from Wrangler-bundled YAML (R2 mode has no disk catalog). */
let workerBundledCatalog: Template[] | null = null;

export function primeWorkerBuiltinCatalog(templates: Template[]): void {
  workerBundledCatalog = templates;
}

let cached: Template[] | null = null;

/** Gallery blueprints versioned in git under `catalog/templates/`. */
export function loadBuiltinCatalogTemplates(): Template[] {
  if (workerBundledCatalog) {
    return workerBundledCatalog;
  }

  if (process.env.NODE_ENV === "production" && cached) {
    return cached;
  }

  const templates = loadFromCommittedDir();

  if (process.env.NODE_ENV === "production") {
    cached = templates;
  }
  return templates;
}
