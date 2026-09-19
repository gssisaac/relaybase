import nodeFs from "node:fs";
import path from "node:path";

import { parseTemplateMetaYaml, type ParsedTemplateMeta } from "./parse-template-meta";

export type BuiltinTemplate = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema?: ParsedTemplateMeta["variablesSchema"];
};

const META_FILE = "meta.yaml";

export function resolveBuiltinTemplatesDir(): string {
  if (process.env.STUDIO_BUILTIN_TEMPLATES_DIR) {
    return path.resolve(process.env.STUDIO_BUILTIN_TEMPLATES_DIR);
  }
  return path.join(process.cwd(), "public", "templates");
}

function readTemplateDir(dirPath: string): BuiltinTemplate | null {
  const metaPath = path.join(dirPath, META_FILE);
  if (!nodeFs.existsSync(metaPath)) return null;

  let parsed: ReturnType<typeof parseTemplateMetaYaml>;
  try {
    parsed = parseTemplateMetaYaml(nodeFs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
  if (!parsed) return null;

  return {
    id: parsed.id,
    name: parsed.name,
    htmlSource: parsed.htmlSource,
    variablesSchema: parsed.variablesSchema,
  };
}

function loadFromCommittedDir(): BuiltinTemplate[] {
  const root = resolveBuiltinTemplatesDir();
  if (!nodeFs.existsSync(root)) {
    console.warn(`[studio] built-in templates dir missing: ${root}`);
    return [];
  }

  const entries = nodeFs.readdirSync(root, { withFileTypes: true });
  const templates: BuiltinTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tpl = readTemplateDir(path.join(root, entry.name));
    if (tpl) templates.push(tpl);
  }

  templates.sort((a, b) => a.name.localeCompare(b.name));
  return templates;
}

/** Set by `worker.ts` from Wrangler-bundled layout meta YAML. */
let workerBundledLayouts: BuiltinTemplate[] | null = null;

export function primeWorkerBuiltinLayouts(templates: BuiltinTemplate[]): void {
  workerBundledLayouts = templates;
}

/** Load built-in design templates from `public/templates/<slug>/meta.yaml`. */
export function loadBuiltinTemplates(): BuiltinTemplate[] {
  if (workerBundledLayouts) {
    return workerBundledLayouts;
  }
  return loadFromCommittedDir();
}
