import type { Message } from "@db/types";
import { getPostgresStoreCache } from "@lib/db/postgres-store-runtime";
import { isCatalogBlueprintMessageId, isLibraryMessageId } from "@lib/messages/message-library";

function messageRows(): Message[] {
  const cache = getPostgresStoreCache();
  if (!cache) {
    throw new Error("PostgreSQL store cache is not initialized");
  }
  return cache.messages;
}

/** Editable messages live in the PostgreSQL store (`messages` table). */
export const messageFileStore = {
  /** Standalone saved copies (not trigger/newsletter-owned, not catalog presets). */
  listLibrary(): Message[] {
    return this.listAll().filter((m) => isLibraryMessageId(m.id));
  },

  /** All editable messages for `/studio/messages` (includes trigger/newsletter bodies). */
  listForGallery(): Message[] {
    return this.listAll().filter((m) => !isCatalogBlueprintMessageId(m.id));
  },

  listAll(): Message[] {
    const messages = [...messageRows()];
    messages.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return messages;
  },

  findById(id: string): Message | undefined {
    return messageRows().find((m) => m.id === id);
  },

  /** No-op — callers must persist via `studioService.update` (PostgreSQL snapshot). */
  save(_message: Message): void {},

  /** No-op — callers must remove via `studioService.update`. */
  delete(_id: string): boolean {
    return true;
  },

  layoutIsReferenced(layoutId: string): boolean {
    return this.listAll().some((m) => m.layoutId === layoutId);
  },
};
