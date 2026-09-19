import {
  normalizeTemplateVariablesSchema,
  parseTemplateVariablesYaml,
} from "@lib/templates/variable-schema";

export type ParsedTemplateMeta = {
  id: string;
  name: string;
  htmlSource: string;
  variablesSchema: ReturnType<typeof normalizeTemplateVariablesSchema>;
};

function unquoteYamlScalar(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function dedentBlock(lines: string[]): string {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return "";
  const indent = Math.min(...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1]?.length ?? 0));
  return lines.map((l) => (l.length >= indent ? l.slice(indent) : l.trimEnd())).join("\n").trimEnd();
}

function isTopLevelKey(line: string): boolean {
  return /^[a-zA-Z][\w-]*:\s*(.*)?$/.test(line) && !/^\s/.test(line);
}

function extractFieldsYaml(source: string): string | null {
  const lines = source.split("\n");
  const idx = lines.findIndex((l) => /^\s*fields:\s*$/.test(l));
  if (idx < 0) return null;

  const baseIndent = lines[idx]!.match(/^(\s*)/)?.[1]?.length ?? 0;
  const block: string[] = [];
  for (let i = idx; i < lines.length; i++) {
    const line = lines[i]!;
    if (i > idx && line.trim()) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      if (indent <= baseIndent) break;
    }
    block.push(line.length >= baseIndent ? line.slice(baseIndent) : line.trimStart());
  }
  return block.join("\n");
}

/**
 * Parse built-in template `meta.yaml` (id, name, multiline `html: |`, optional `variables.fields`).
 */
export function parseTemplateMetaYaml(source: string): ParsedTemplateMeta | null {
  const lines = source.split("\n");
  let id: string | undefined;
  let name: string | undefined;
  let htmlSource: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const idMatch = line.match(/^id:\s*(.+)$/);
    if (idMatch) {
      id = unquoteYamlScalar(idMatch[1]!);
      i += 1;
      continue;
    }

    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = unquoteYamlScalar(nameMatch[1]!);
      i += 1;
      continue;
    }

    if (/^html:\s*\|\s*$/.test(line)) {
      i += 1;
      const block: string[] = [];
      while (i < lines.length) {
        const next = lines[i]!;
        if (isTopLevelKey(next)) break;
        block.push(next);
        i += 1;
      }
      htmlSource = dedentBlock(block);
      continue;
    }

    const htmlInline = line.match(/^html:\s*(.+)$/);
    if (htmlInline) {
      htmlSource = unquoteYamlScalar(htmlInline[1]!);
      i += 1;
      continue;
    }

    i += 1;
  }

  if (!id?.trim() || !name?.trim() || htmlSource === undefined) return null;

  const variablesSchema = normalizeTemplateVariablesSchema(
    parseTemplateVariablesYaml(extractFieldsYaml(source) ?? ""),
  );

  return {
    id: id.trim(),
    name: name.trim(),
    htmlSource,
    variablesSchema,
  };
}
