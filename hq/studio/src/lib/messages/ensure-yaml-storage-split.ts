import fs from "node:fs";
import path from "node:path";

import { isOwnedMessageId } from "./message-library";

function dataRoot(): string {
  return process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function yamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
}

function copyYamlFile(from: string, toDir: string) {
  ensureDir(toDir);
  const dest = path.join(toDir, path.basename(from));
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(from, dest);
  }
}

/**
 * Retired `data/template-catalog/` → every file is a gallery blueprint under `data/templates/`.
 * Owned ids also get an editable copy under `data/messages/` when missing.
 */
function migrateObsoleteTemplateCatalog(
  obsoleteCatalogDir: string,
  templatesDir: string,
  messagesDir: string,
) {
  if (!fs.existsSync(obsoleteCatalogDir)) return;

  for (const file of yamlFiles(obsoleteCatalogDir)) {
    const from = path.join(obsoleteCatalogDir, file);
    copyYamlFile(from, templatesDir);
    const id = file.replace(/\.(yaml|yml)$/, "");
    if (isOwnedMessageId(id)) {
      copyYamlFile(from, messagesDir);
    }
    fs.unlinkSync(from);
  }

  if (yamlFiles(obsoleteCatalogDir).length === 0) {
    try {
      fs.rmdirSync(obsoleteCatalogDir);
    } catch {
      /* not empty */
    }
  }
}

/**
 * Gallery blueprints live in `data/templates/`; editable bodies in `data/messages/`.
 * The same `msgtpl_*` id may exist in both directories (catalog vs runtime copy).
 */
export function ensureYamlStorageSplit(): void {
  const root = dataRoot();
  const templatesDir = path.join(root, "templates");
  const messagesDir = path.join(root, "messages");
  const obsoleteCatalogDir = path.join(root, "template-catalog");

  ensureDir(templatesDir);
  ensureDir(messagesDir);

  migrateObsoleteTemplateCatalog(obsoleteCatalogDir, templatesDir, messagesDir);
}
