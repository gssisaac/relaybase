import type { Layout } from "@db/types";

/** JSON shape for GET /studio/templates (layouts — HTML frames). */
export function serializeLayout(row: Layout) {
  return {
    id: row.id,
    name: row.name,
    htmlSource: row.htmlSource,
    variablesSchema: row.variablesSchema ?? null,
    isBuiltin: row.isBuiltin,
    derivedFromLayoutId: row.derivedFromLayoutId ?? null,
    createdAt: row.createdAt,
  };
}
