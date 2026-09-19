import type { StudioDataStore } from "@db/types";
import {
  defaultStudioDocument,
  reconcileAndHydrateStore,
} from "@services/studio/store-reconcile";
import {
  loadStudioDocumentFromDb,
  persistStudioDocument,
} from "@services/studio/studio-document.persist";

let document: StudioDataStore | null = null;
let persistChain: Promise<void> = Promise.resolve();

export function readStudioDocument(): StudioDataStore {
  if (!document) {
    throw new Error("Studio document is not initialized. Call initStudioDocument() first.");
  }
  return structuredClone(document);
}

export function mutateStudioDocument(mutator: (draft: StudioDataStore) => void): StudioDataStore {
  if (!document) {
    throw new Error("Studio document is not initialized. Call initStudioDocument() first.");
  }
  const draft = structuredClone(document);
  mutator(draft);
  const { store: reconciled } = reconcileAndHydrateStore(draft);
  document = reconciled;
  persistChain = persistChain
    .then(() => persistStudioDocument(reconciled))
    .catch((err) => {
      console.error("[studio-document] PostgreSQL persist failed:", err);
      throw err;
    });
  return structuredClone(reconciled);
}

export async function initStudioDocument(): Promise<void> {
  const loaded = await loadStudioDocumentFromDb();
  if (!loaded) {
    const seeded = reconcileAndHydrateStore(defaultStudioDocument());
    document = seeded.store;
    await persistStudioDocument(seeded.store);
    return;
  }

  const { store: reconciled, dirty } = reconcileAndHydrateStore(loaded);
  document = reconciled;
  if (dirty) {
    await persistStudioDocument(reconciled);
  }
}

export async function flushStudioDocumentPersist(): Promise<void> {
  await persistChain;
}
