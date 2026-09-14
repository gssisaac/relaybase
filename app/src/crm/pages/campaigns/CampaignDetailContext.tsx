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

import {
  crmApi,
  type Broadcast,
  type BroadcastMember,
  type CrmTemplate,
} from "@/lib/crm/api";

type DraftFields = { subject: string; bodyMarkdown: string; templateId: string };

type Ctx = {
  broadcastId: string;
  broadcast: Broadcast | null;
  templates: CrmTemplate[];
  audienceMembers: BroadcastMember[];
  loading: boolean;
  notFound: boolean;
  setBroadcast: (broadcast: Broadcast) => void;
  refresh: () => Promise<void>;
  refreshAudience: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const BroadcastDetailCtx = createContext<Ctx | null>(null);

export function BroadcastDetailProvider({
  broadcastId,
  children,
}: {
  broadcastId: string;
  children: ReactNode;
}) {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [audienceMembers, setAudienceMembers] = useState<BroadcastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({ subject: "", bodyMarkdown: "", templateId: "" });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const broadcastRef = useRef<Broadcast | null>(null);
  broadcastRef.current = broadcast;

  const refreshAudience = useCallback(async () => {
    const { members } = await crmApi.listBroadcastAudience(broadcastId);
    setAudienceMembers(members);
  }, [broadcastId]);

  const refresh = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([
        crmApi.getBroadcast(broadcastId),
        crmApi.listTemplates(),
      ]);
      setBroadcast(b);
      setTemplates(t.templates);
      setNotFound(false);
      const fields = {
        subject: b.subject,
        bodyMarkdown: b.bodyMarkdown,
        templateId: b.templateId ?? "",
      };
      draftRef.current = fields;
      lastSaved.current = fields;
      await refreshAudience();
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setBroadcast(null);
    } finally {
      setLoading(false);
    }
  }, [broadcastId, refreshAudience]);

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
      .updateBroadcast(broadcastId, next)
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
  }, [broadcastId]);

  return (
    <BroadcastDetailCtx.Provider
      value={{
        broadcastId,
        broadcast,
        templates,
        audienceMembers,
        loading,
        notFound,
        setBroadcast,
        refresh,
        refreshAudience,
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

/** @deprecated use useBroadcastDetail */
export const useCampaignDetail = useBroadcastDetail;

/** @deprecated use BroadcastDetailProvider */
export const CampaignDetailProvider = BroadcastDetailProvider;
