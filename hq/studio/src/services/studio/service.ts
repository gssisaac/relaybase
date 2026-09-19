import type { StudioDataStore } from "@db/types";
import {
  flushStudioDocumentPersist,
  initStudioDocument,
  mutateStudioDocument,
  readStudioDocument,
} from "@services/studio/studio-document.service";

export class StudioDocumentService {
  private static instance: StudioDocumentService;

  static getInstance(): StudioDocumentService {
    if (!StudioDocumentService.instance) {
      StudioDocumentService.instance = new StudioDocumentService();
    }
    return StudioDocumentService.instance;
  }

  read(): StudioDataStore {
    return readStudioDocument();
  }

  mutate(mutator: (draft: StudioDataStore) => void): StudioDataStore {
    return mutateStudioDocument(mutator);
  }

  init(): Promise<void> {
    return initStudioDocument();
  }

  flushPersist(): Promise<void> {
    return flushStudioDocumentPersist();
  }
}

export const studioDocumentService = StudioDocumentService.getInstance();
