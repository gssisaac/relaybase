/** Message owned by a trigger or newsletter (`msgtpl_{ownerId}`). */
export function isOwnedMessageId(id: string): boolean {
  return /^msgtpl_(automation_|broadcast_)/.test(id);
}

/** Read-only catalog blueprints — live under `template-catalog/`, not Messages. */
export function isCatalogBlueprintMessageId(id: string): boolean {
  return id.startsWith("msgtpl_preset_");
}

export function isLibraryMessageId(id: string): boolean {
  return !isOwnedMessageId(id) && !isCatalogBlueprintMessageId(id);
}
