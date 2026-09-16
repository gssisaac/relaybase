"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { attachLifecycleListeners } from "./lifecycle-listeners";
import { createEditorPersistenceCoordinator } from "./coordinator";
import type { EditorPersistenceCoordinator } from "./coordinator";
import {
  createNewsletterPersistAdapter,
  type NewsletterPersistBridge,
} from "./newsletter-persist-adapter";
import { useEditorSnapshotRef } from "./editor-capture";
import { SCALE_PERSIST_ROOT, type EditorSnapshotProvider, type Mode, type SaveStatus } from "./types";

export type UseNewsletterEditorPersistenceOptions = {
  /** Document identity / local persistence key (e.g. newsletter id). */
  newsletterId: string;
  /**
   * `/scale/newsletters/…` suffix for the tab-close beacon PATCH, when it
   * differs from `newsletterId` (e.g. nested workspace path under the newsletter).
   * Defaults to `newsletterId`.
   */
  beaconPath?: string;
  editable: boolean;
  bridge: NewsletterPersistBridge;
};

export type UseNewsletterEditorPersistenceResult = {
  editorRef: React.MutableRefObject<EditorSnapshotProvider | null>;
  ingestBody: (markdown: string, sourceNewsletterId?: string) => void;
  checkpoint: (reason: Parameters<EditorPersistenceCoordinator["checkpoint"]>[0]) => Promise<void>;
  saveStatus: SaveStatus | null;
};

export function useNewsletterEditorPersistence(
  options: UseNewsletterEditorPersistenceOptions,
): UseNewsletterEditorPersistenceResult {
  const { newsletterId, beaconPath, editable, bridge } = options;
  const { editorRef, getSnapshot } = useEditorSnapshotRef();
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const newsletterIdRef = useRef(newsletterId);
  const beaconPathRef = useRef(beaconPath);
  const editableRef = useRef(editable);
  newsletterIdRef.current = newsletterId;
  beaconPathRef.current = beaconPath;
  editableRef.current = editable;

  const getEditContext = useCallback(
    () => ({
      root: SCALE_PERSIST_ROOT,
      path: newsletterIdRef.current,
      beaconPath: beaconPathRef.current ?? newsletterIdRef.current,
      mode: (editableRef.current ? "edit" : "read") as Mode,
    }),
    [],
  );

  const adapter = useMemo(() => createNewsletterPersistAdapter(bridge), [bridge]);

  const coordinator = useMemo(
    () =>
      createEditorPersistenceCoordinator({
        getSnapshot,
        persistAdapter: adapter,
        getEditContext,
        onStatusChange: (next) => setSaveStatus(next),
      }),
    [getSnapshot, adapter, getEditContext],
  );

  useEffect(() => {
    const detach = attachLifecycleListeners(coordinator);
    coordinator.start();
    return () => {
      detach();
      coordinator.stop();
    };
  }, [coordinator]);

  const ingestBody = useCallback(
    (markdown: string, sourceNewsletterId?: string) => {
      coordinator.ingest(markdown, sourceNewsletterId ?? newsletterIdRef.current);
    },
    [coordinator],
  );

  const checkpoint = useCallback(
    async (reason: Parameters<EditorPersistenceCoordinator["checkpoint"]>[0]) => {
      await coordinator.checkpoint(reason);
    },
    [coordinator],
  );

  return { editorRef, ingestBody, checkpoint, saveStatus };
}
