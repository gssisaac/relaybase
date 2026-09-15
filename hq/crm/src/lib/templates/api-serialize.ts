import type { Template } from "../../db/types";

export function serializeTemplate(row: Template) {
  return {
    id: row.id,
    name: row.name,
    htmlSource: row.htmlSource,
    variablesSchema: row.variablesSchema ?? null,
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt,
  };
}
