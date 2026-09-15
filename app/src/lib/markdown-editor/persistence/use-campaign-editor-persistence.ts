"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { attachLifecycleListeners } from "./lifecycle-listeners";
import { createEditorPersistenceCoordinator } from "./coordinator";
import type { EditorPersistenceCoordinator } from "./coordinator";
import {
  createCampaignPersistAdapter,
  type CampaignPersistBridge,
} from "./campaign-persist-adapter";
import { useEditorSnapshotRef } from "./editor-capture";
import { SCALE_PERSIST_ROOT, type EditorSnapshotProvider, type Mode, type SaveStatus } from "./types";

export type UseCampaignEditorPersistenceOptions = {
  /** Document identity / local persistence key (e.g. campaign id). */
  campaignId: string;
  /**
   * `/scale/campaigns/…` suffix for the tab-close beacon PATCH, when it
   * differs from `campaignId` (e.g. nested workspace path under the campaign).
   * Defaults to `campaignId`.
   */
  beaconPath?: string;
  editable: boolean;
  bridge: CampaignPersistBridge;
};

export type UseCampaignEditorPersistenceResult = {
  editorRef: React.MutableRefObject<EditorSnapshotProvider | null>;
  ingestBody: (markdown: string, sourceCampaignId?: string) => void;
  checkpoint: (reason: Parameters<EditorPersistenceCoordinator["checkpoint"]>[0]) => Promise<void>;
  saveStatus: SaveStatus | null;
};

export function useCampaignEditorPersistence(
  options: UseCampaignEditorPersistenceOptions,
): UseCampaignEditorPersistenceResult {
  const { campaignId, beaconPath, editable, bridge } = options;
  const { editorRef, getSnapshot } = useEditorSnapshotRef();
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const campaignIdRef = useRef(campaignId);
  const beaconPathRef = useRef(beaconPath);
  const editableRef = useRef(editable);
  campaignIdRef.current = campaignId;
  beaconPathRef.current = beaconPath;
  editableRef.current = editable;

  const getEditContext = useCallback(
    () => ({
      root: SCALE_PERSIST_ROOT,
      path: campaignIdRef.current,
      beaconPath: beaconPathRef.current ?? campaignIdRef.current,
      mode: (editableRef.current ? "edit" : "read") as Mode,
    }),
    [],
  );

  const adapter = useMemo(() => createCampaignPersistAdapter(bridge), [bridge]);

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
    (markdown: string, sourceCampaignId?: string) => {
      coordinator.ingest(markdown, sourceCampaignId ?? campaignIdRef.current);
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
