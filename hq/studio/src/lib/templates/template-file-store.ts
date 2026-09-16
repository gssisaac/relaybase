import fs from "node:fs";
import path from "node:path";

import { Document, isScalar, parse as parseYaml, Scalar } from "yaml";

import type { Template } from "../../db/types";
import { getPresetMessageTemplates } from "../messages/preset-templates";

function resolveTemplatesDir(): string {
  if (process.env.STUDIO_TEMPLATES_DIR) {
    return path.resolve(process.env.STUDIO_TEMPLATES_DIR);
  }
  const dataDir =
    process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dataDir, "templates");
}

function normalizeLoadedTemplate(row: Template): Template {
  if (row.layoutId === "tpl-header-image") {
    row.layoutId = "tpl-header";
  }
  if (row.templateVariables === undefined) row.templateVariables = {};
  if (row.previewText === undefined) row.previewText = null;
  return row;
}

function isTemplateRecord(value: unknown): value is Template {
  if (!value || typeof value !== "object") return false;
  const row = value as Template;
  return typeof row.id === "string" && typeof row.name === "string";
}

function ensureTemplatesDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function templateFilePath(dir: string, id: string): string {
  return path.join(dir, `${id}.yaml`);
}

function readTemplateFile(filePath: string): Template | null {
  try {
    const parsed = parseYaml(fs.readFileSync(filePath, "utf8"));
    if (!isTemplateRecord(parsed)) return null;
    return normalizeLoadedTemplate(parsed);
  } catch (err) {
    console.error(`[template-store] Failed to parse ${filePath}:`, err);
    return null;
  }
}

function stringifyTemplate(template: Template): string {
  const doc = new Document(template);
  const bodyNode = doc.getIn(["bodyMarkdown"], true);
  if (
    bodyNode &&
    isScalar(bodyNode) &&
    typeof bodyNode.value === "string" &&
    bodyNode.value.includes("\n")
  ) {
    bodyNode.type = Scalar.BLOCK_LITERAL;
  }
  return String(doc);
}

function writeTemplateFile(dir: string, template: Template) {
  ensureTemplatesDir(dir);
  fs.writeFileSync(
    templateFilePath(dir, template.id),
    `${stringifyTemplate(template)}\n`,
    "utf8",
  );
}

function seedPresetTemplates(dir: string): void {
  const now = new Date().toISOString();
  for (const preset of getPresetMessageTemplates(now)) {
    writeTemplateFile(dir, preset);
  }
}

/** Message templates persisted as one YAML file per template under `data/templates/`. */
export const templateFileStore = {
  dataDir: resolveTemplatesDir(),

  listAll(): Template[] {
    const dir = resolveTemplatesDir();
    ensureTemplatesDir(dir);

    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));

    if (files.length === 0) {
      seedPresetTemplates(dir);
      return this.listAll();
    }

    const templates: Template[] = [];
    for (const file of files) {
      const row = readTemplateFile(path.join(dir, file));
      if (row) templates.push(row);
    }

    templates.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return templates;
  },

  findById(id: string): Template | undefined {
    const direct = readTemplateFile(templateFilePath(resolveTemplatesDir(), id));
    if (direct) return direct;
    return this.listAll().find((t) => t.id === id);
  },

  save(template: Template): void {
    writeTemplateFile(resolveTemplatesDir(), normalizeLoadedTemplate({ ...template }));
  },

  delete(id: string): boolean {
    const filePath = templateFilePath(resolveTemplatesDir(), id);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  },

  layoutIsReferenced(layoutId: string): boolean {
    return this.listAll().some((t) => t.layoutId === layoutId);
  },

  /** One-time export from legacy `store.json` `templates[]`. */
  importFromLegacyRows(rows: Template[]): number {
    if (rows.length === 0) return 0;
    const dir = resolveTemplatesDir();
    ensureTemplatesDir(dir);
    let written = 0;
    for (const row of rows) {
      writeTemplateFile(dir, normalizeLoadedTemplate({ ...row }));
      written += 1;
    }
    return written;
  },
};
