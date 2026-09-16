import fs from "node:fs";
import path from "node:path";

import { parse as parseYaml } from "yaml";

function dataRoot(): string {
  return process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

/**
 * One-time move from legacy `data/templates/` into
 * `data/template-catalog/` (presets) and `data/messages/` (editable).
 */
export function ensureYamlStorageSplit(): void {
  const root = dataRoot();
  const legacyDir = path.join(root, "templates");
  const catalogDir = path.join(root, "template-catalog");
  const messagesDir = path.join(root, "messages");

  if (!fs.existsSync(legacyDir)) return;

  const legacyFiles = fs
    .readdirSync(legacyDir)
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
  if (legacyFiles.length === 0) return;

  const messagesAlready =
    fs.existsSync(messagesDir) &&
    fs.readdirSync(messagesDir).some((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
  const catalogAlready =
    fs.existsSync(catalogDir) &&
    fs.readdirSync(catalogDir).some((name) => name.endsWith(".yaml") || name.endsWith(".yml"));

  if (messagesAlready && catalogAlready) {
    return;
  }

  ensureDir(catalogDir);
  ensureDir(messagesDir);

  for (const file of legacyFiles) {
    const from = path.join(legacyDir, file);
    const raw = fs.readFileSync(from, "utf8");
    const parsed = parseYaml(raw);
    const isPreset = isRecord(parsed) && parsed.isPreset === true;
    const destDir = isPreset ? catalogDir : messagesDir;
    const dest = path.join(destDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(from, dest);
    }
    fs.unlinkSync(from);
  }
}
