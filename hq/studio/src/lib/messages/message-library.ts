/** Message owned by a trigger or newsletter (`msgtpl_{ownerId}`). */
export function isOwnedMessageId(id: string): boolean {
  return /^msgtpl_(automation_|broadcast_)/.test(id);
}

/** Read-only catalog blueprints — live under `data/templates/`, not Messages. */
export function isCatalogBlueprintMessageId(id: string): boolean {
  return id.startsWith("msgtpl_preset_");
}

export function isLibraryMessageId(id: string): boolean {
  return id.startsWith("msg_library_");
}

/** YAML ids stored under `data/templates/` (gallery blueprints). */
export function isCatalogTemplateId(id: string): boolean {
  return isCatalogBlueprintMessageId(id) || isLibraryMessageId(id);
}
