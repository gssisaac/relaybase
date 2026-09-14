/**
 * CRM campaign editor persistence (adapted from Railmark editor-persistence).
 */

export type CrmPersistRoot = "crm";
export const CRM_PERSIST_ROOT: CrmPersistRoot = "crm";

export type Mode = "read" | "edit";

export type EditContext = {
  root: CrmPersistRoot | null;
  /** Campaign id */
  path: string | null;
  mode: Mode;
};

export type CheckpointReason =
  | "editor-interval"
  | "editor-unmount"
  | "editor-blur"
  | "editor-composition-end"
  | "editor-debounce"
  | "route-hashchange"
  | "route-popstate"
  | "beforeunload"
  | "pagehide"
  | "pagehide-async"
  | "visibility-hidden"
  | "freeze"
  | "unload"
  | "manual-save";

export type CheckpointResult = {
  captured: boolean;
  flushed: boolean;
  persisted: boolean;
  path: string | null;
  error: unknown | null;
};

export type EditorSnapshotProvider = {
  flushSnapshot(): string | null;
  filePath: string;
};

export type PersistAdapter = {
  ingest(ctx: EditContext, content: string): void;
  flush(ctx: EditContext, content?: string): Promise<void>;
  isDirty(ctx: EditContext): boolean;
  getCachedContent(ctx: EditContext): string | null;
  getPersistedContent(ctx: EditContext): string | null;
};

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type EditorPersistenceConfig = {
  getSnapshot: () => EditorSnapshotProvider | null;
  persistAdapter: PersistAdapter;
  getEditContext: () => EditContext;
  onStatusChange?: (status: SaveStatus) => void;
};
