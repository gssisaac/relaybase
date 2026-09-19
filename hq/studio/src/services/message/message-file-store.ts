import type { Message } from "@db/types";
import { isCatalogBlueprintMessageId, isLibraryMessageId } from "@services/message/message-library";
import { readStudioDocument } from "@services/studio/studio-document.service";

function messageRows(): Message[] {
  return readStudioDocument().messages;
}

/** Editable messages live in PostgreSQL (`messages` table). */
export const messageFileStore = {
  listLibrary(): Message[] {
    return this.listAll().filter((m) => isLibraryMessageId(m.id));
  },

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

  /** No-op — callers persist via `mutateStudioDocument`. */
  save(_message: Message): void {},

  /** No-op — callers remove via `mutateStudioDocument`. */
  delete(_id: string): boolean {
    return true;
  },

  layoutIsReferenced(layoutId: string): boolean {
    return this.listAll().some((m) => m.layoutId === layoutId);
  },
};
