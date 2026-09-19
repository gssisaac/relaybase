import fs from "../../cf/storage-fs";
import path from "node:path";

import { Document, isScalar, parse as parseYaml, Scalar } from "yaml";

import type { Template } from "../../db/types";
import { ensureYamlStorageSplit } from "../messages/ensure-yaml-storage-split";
import { getPresetTemplates } from "../messages/preset-templates";

function resolveCatalogDir(): string {
  const dataDir = process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dataDir, "templates");
}

function normalizeCatalogTemplate(row: Template): Template {
  if (row.layoutId === "tpl-header-image") {
    row.layoutId = "tpl-header";
  }
  if (row.templateVariables === undefined) row.templateVariables = {};
  if (row.previewText === undefined) row.previewText = null;
  if (row.description === undefined) row.description = null;
  row.isBuiltin = true;
  return row;
}

function isTemplateRecord(value: unknown): value is Template {
  if (!value || typeof value !== "object") return false;
  const row = value as Template & { accountLinkId?: string; isPreset?: boolean };
  return typeof row.id === "string" && typeof row.name === "string";
}

function legacyYamlToTemplate(parsed: Record<string, unknown>): Template {
  const layoutId =
    parsed.layoutId === "tpl-header-image" ? "tpl-header" : (parsed.layoutId as string);
  const now = new Date().toISOString();
  return normalizeCatalogTemplate({
    id: parsed.id as string,
    name: parsed.name as string,
    description: (parsed.description as string | null | undefined) ?? (parsed.previewText as string | null) ?? null,
    subject: (parsed.subject as string) ?? "",
    previewText: (parsed.previewText as string | null | undefined) ?? null,
    bodyMarkdown: (parsed.bodyMarkdown as string) ?? "",
    layoutId: layoutId ?? "tpl-minimal",
    templateVariables: (parsed.templateVariables as Record<string, string>) ?? {},
    category: (parsed.category as Template["category"]) ?? undefined,
    isBuiltin: true,
    createdAt: (parsed.createdAt as string) ?? now,
    updatedAt: (parsed.updatedAt as string) ?? now,
  });
}

function catalogFilePath(dir: string, id: string): string {
  return path.join(dir, `${id}.yaml`);
}

function readCatalogFile(filePath: string): Template | null {
  try {
    const parsed = parseYaml(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (isTemplateRecord(parsed)) return normalizeCatalogTemplate(parsed);
    const legacy = parsed as Record<string, unknown>;
    if (typeof legacy.id === "string" && typeof legacy.name === "string") {
      return legacyYamlToTemplate(legacy);
    }
    return null;
  } catch (err) {
    console.error(`[templates] Failed to parse catalog ${filePath}:`, err);
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
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    catalogFilePath(dir, template.id),
    `${stringifyTemplate(template)}\n`,
    "utf8",
  );
}

function seedPresetTemplates(dir: string): void {
  const now = new Date().toISOString();
  fs.mkdirSync(dir, { recursive: true });
  for (const preset of getPresetTemplates(now)) {
    fs.writeFileSync(
      catalogFilePath(dir, preset.id),
      `${stringifyTemplate(preset)}\n`,
      "utf8",
    );
  }
}

/** Read-only template catalog (blueprints). */
export const templateCatalogStore = {
  dataDir: resolveCatalogDir(),

  listAll(): Template[] {
    ensureYamlStorageSplit();
    const dir = resolveCatalogDir();
    fs.mkdirSync(dir, { recursive: true });

    let files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));

    if (files.length === 0) {
      seedPresetTemplates(dir);
      files = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"));
    }

    const templates: Template[] = [];
    for (const file of files) {
      const row = readCatalogFile(path.join(dir, file));
      if (row) templates.push(row);
    }

    templates.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return templates;
  },

  findById(id: string): Template | undefined {
    ensureYamlStorageSplit();
    const direct = readCatalogFile(catalogFilePath(resolveCatalogDir(), id));
    if (direct) return direct;
    return this.listAll().find((t) => t.id === id);
  },

  save(template: Template): void {
    writeTemplateFile(resolveCatalogDir(), normalizeCatalogTemplate({ ...template }));
  },
};
