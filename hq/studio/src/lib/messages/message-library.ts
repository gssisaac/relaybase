/** Message owned by a trigger or newsletter (`msgtpl_{ownerId}`). */
export function isOwnedMessageId(id: string): boolean {
  return /^msgtpl_(automation_|broadcast_)/.test(id);
}

/** Read-only catalog blueprints — git `catalog/templates/`, not Messages. */
export function isCatalogBlueprintMessageId(id: string): boolean {
  return id.startsWith("msgtpl_preset_");
}

export function isLibraryMessageId(id: string): boolean {
  return id.startsWith("msg_library_");
}

/** Catalog template ids (gallery blueprints in `catalog/templates/`). */
export function isCatalogTemplateId(id: string): boolean {
  return isCatalogBlueprintMessageId(id) || isLibraryMessageId(id);
}
