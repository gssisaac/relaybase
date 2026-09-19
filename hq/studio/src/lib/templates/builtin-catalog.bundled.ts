import type { Template } from "../../db/types";
import { BUILTIN_CATALOG_YAML } from "./builtin-catalog.imports";
import { parseCatalogYaml } from "./parse-catalog-yaml";

/** Loaded only in the Worker bundle (Wrangler Text rules on *.yaml). */
export function loadBundledCatalogTemplates(): Template[] {
  const templates: Template[] = [];
  for (const source of BUILTIN_CATALOG_YAML) {
    const row = parseCatalogYaml(source);
    if (row) templates.push(row);
  }
  templates.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return templates;
}
