import { Document, isScalar, Scalar } from "yaml";

import type { Template } from "../../db/types";
import { loadBuiltinCatalogTemplates } from "./builtin-catalog";
import { normalizeCatalogTemplate } from "./parse-catalog-yaml";

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

/** Read-only template catalog (blueprints from `catalog/templates/` in git). */
export const templateCatalogStore = {
  listAll(): Template[] {
    return loadBuiltinCatalogTemplates();
  },

  findById(id: string): Template | undefined {
    return loadBuiltinCatalogTemplates().find((t) => t.id === id);
  },

  /** Gallery blueprints are git-managed; runtime writes are not supported. */
  save(template: Template): void {
    void stringifyTemplate(normalizeCatalogTemplate({ ...template }));
    console.warn(
      "[templates] templateCatalogStore.save is deprecated — edit catalog/templates/*.yaml in git",
    );
  },
};
