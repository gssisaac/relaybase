import type { BuiltinTemplate } from "@services/template/load-builtin-templates";
import { BUILTIN_LAYOUT_META_YAML } from "@services/template/builtin-layout-meta.imports";
import { parseTemplateMetaYaml } from "@services/template/parse-template-meta";

/** Loaded only in the Worker bundle (Wrangler Text rules on *.yaml). */
export function loadBundledBuiltinLayouts(): BuiltinTemplate[] {
  const templates: BuiltinTemplate[] = [];
  for (const source of BUILTIN_LAYOUT_META_YAML) {
    const parsed = parseTemplateMetaYaml(source);
    if (!parsed) continue;
    templates.push({
      id: parsed.id,
      name: parsed.name,
      htmlSource: parsed.htmlSource,
      variablesSchema: parsed.variablesSchema,
    });
  }
  templates.sort((a, b) => a.name.localeCompare(b.name));
  return templates;
}
