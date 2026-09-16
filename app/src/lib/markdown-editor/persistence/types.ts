/**
 * Scale newsletter editor persistence (adapted from Railmark editor-persistence).
 */

export type ScalePersistRoot = "scale";
export const SCALE_PERSIST_ROOT: ScalePersistRoot = "scale";

export type Mode = "read" | "edit";

export type EditContext = {
  root: ScalePersistRoot | null;
  /** Local snapshot/draft storage key — the document identity (e.g. newsletter or template id). */
  path: string | null;
  /**
   * `/scale/newsletters/…` suffix used by the tab-close beacon PATCH — may
   * differ from `path` when the document lives under a parent resource
   * (e.g. a nested workspace path under the newsletter id). Falls back to `path`.
   */
  beaconPath?: string | null;
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
  /** Insert plain text at the editor caret (merge tags, etc.). */
  insertText?: (text: string) => void;
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
