"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { crmApi, type Broadcast } from "@/lib/crm/api";

type DraftFields = { subject: string; bodyMarkdown: string; templateId: string };

type Ctx = {
  campaignId: string;
  broadcastId: string;
  broadcast: Broadcast | null;
  loading: boolean;
  notFound: boolean;
  setBroadcast: (broadcast: Broadcast) => void;
  refresh: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const BroadcastDetailCtx = createContext<Ctx | null>(null);

export function BroadcastDetailProvider({
  campaignId,
  broadcastId,
  children,
}: {
  campaignId: string;
  broadcastId: string;
  children: ReactNode;
}) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({ subject: "", bodyMarkdown: "", templateId: "" });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const broadcastRef = useRef<Broadcast | null>(null);
  broadcastRef.current = broadcast;

  const refresh = useCallback(async () => {
    try {
      const b = await crmApi.getBroadcast(campaignId, broadcastId);
      setBroadcast(b);
      setNotFound(false);
      const fields = { subject: b.subject, bodyMarkdown: b.bodyMarkdown, templateId: b.templateId ?? "" };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setBroadcast(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, broadcastId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    lastSaved.current = null;
    void refresh();
  }, [refresh]);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const getLastSavedDraft = useCallback((): DraftFields => {
    return lastSaved.current ?? draftRef.current;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    const current = broadcastRef.current;
    if (!current || current.status !== "draft") return Promise.resolve(true);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId
    ) {
      return Promise.resolve(true);
    }

    const run = crmApi
      .updateBroadcast(campaignId, broadcastId, next)
      .then((updated) => {
        lastSaved.current = next;
        setBroadcast(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [campaignId, broadcastId]);

  return (
    <BroadcastDetailCtx.Provider
      value={{
        campaignId,
        broadcastId,
        broadcast,
        loading,
        notFound,
        setBroadcast,
        refresh,
        syncDraft,
        persistDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </BroadcastDetailCtx.Provider>
  );
}

export function useBroadcastDetail() {
  const ctx = useContext(BroadcastDetailCtx);
  if (!ctx) throw new Error("useBroadcastDetail must be used inside BroadcastDetailProvider");
  return ctx;
}
