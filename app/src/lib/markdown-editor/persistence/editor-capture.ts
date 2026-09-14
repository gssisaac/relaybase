/**
 * Editor capture — pulls the current content out of the editor component
 * on a fixed interval so edits that BlockNote batched or never emitted
 * via `onChange` still reach the store.
 *
 * The actual interval is owned by the coordinator (so it can be stopped
 * on unmount). This file exports the snapshot-provider type and a small
 * React hook that wires the editor's `flushSnapshot` ref into the
 * coordinator's `getSnapshot` config.
 *
 * See POLICY.md §2 layer 1.
 */

import { useRef } from "react";

import type { EditorSnapshotProvider } from "./types";

/**
 * Keep a ref to the latest snapshot provider and expose a stable
 * `getSnapshot` function for the coordinator config. Call this from
 * the App with the editor's forwarded ref.
 */
export function useEditorSnapshotRef(): {
  editorRef: React.MutableRefObject<EditorSnapshotProvider | null>;
  getSnapshot: () => EditorSnapshotProvider | null;
} {
  const editorRef = useRef<EditorSnapshotProvider | null>(null);
  return {
    editorRef,
    getSnapshot: () => editorRef.current,
  };
}

/** Re-export the provider type for editors that implement it. */
export type { EditorSnapshotProvider };
