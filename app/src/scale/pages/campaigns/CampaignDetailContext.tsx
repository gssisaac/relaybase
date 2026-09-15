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
  scaleApi,
  type Campaign,
  type CampaignMember,
  type ScaleLayout,
} from "@/lib/scale/api";

type DraftFields = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
  messageTemplateId: string | null;
};

type Ctx = {
  campaignId: string;
  campaign: Campaign | null;
  templates: ScaleLayout[];
  audienceMembers: CampaignMember[];
  loading: boolean;
  notFound: boolean;
  setCampaign: (campaign: Campaign) => void;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshAudience: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => DraftFields;
};

const CampaignDetailCtx = createContext<Ctx | null>(null);

export function CampaignDetailProvider({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<ScaleLayout[]>([]);
  const [audienceMembers, setAudienceMembers] = useState<CampaignMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({
    subject: "",
    bodyMarkdown: "",
    templateId: "",
    templateVariables: {},
    messageTemplateId: null,
  });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;

  const refreshAudience = useCallback(async () => {
    const { members } = await scaleApi.listCampaignAudience(campaignId);
    setAudienceMembers(members);
  }, [campaignId]);

  const refreshTemplates = useCallback(async () => {
    const t = await scaleApi.listLayouts();
    setTemplates(t.layouts);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([
        scaleApi.getCampaign(campaignId),
        scaleApi.listLayouts(),
      ]);
      setCampaign(b);
      setTemplates(t.layouts);
      setNotFound(false);
      const fields = {
        subject: b.subject,
        bodyMarkdown: b.bodyMarkdown,
        templateId: b.layoutId ?? "",
        templateVariables: b.templateVariables ?? {},
        messageTemplateId: b.messageTemplateId ?? null,
      };
      draftRef.current = fields;
      lastSaved.current = fields;
      try {
        await refreshAudience();
      } catch {
        setAudienceMembers([]);
      }
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, refreshAudience]);

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
    const current = campaignRef.current;
    if (!current || current.status !== "draft") return Promise.resolve(true);
    if (persistInFlight.current) return persistInFlight.current;

    const next = draftRef.current;
    const prev = lastSaved.current;
    if (
      prev &&
      prev.subject === next.subject &&
      prev.bodyMarkdown === next.bodyMarkdown &&
      prev.templateId === next.templateId &&
      prev.messageTemplateId === next.messageTemplateId &&
      templateVariablesEqual(prev.templateVariables, next.templateVariables)
    ) {
      return Promise.resolve(true);
    }

    const run = scaleApi
      .updateCampaign(campaignId, {
        subject: next.subject,
        bodyMarkdown: next.bodyMarkdown,
        layoutId: next.templateId,
        templateVariables: next.templateVariables,
        messageTemplateId: next.messageTemplateId,
      })
      .then((updated) => {
        lastSaved.current = next;
        setCampaign(updated);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        persistInFlight.current = null;
      });
    persistInFlight.current = run;
    return run;
  }, [campaignId]);

  return (
    <CampaignDetailCtx.Provider
      value={{
        campaignId,
        campaign,
        templates,
        audienceMembers,
        loading,
        notFound,
        setCampaign,
        refresh,
        refreshTemplates,
        refreshAudience,
        syncDraft,
        persistDraft,
        getLastSavedDraft,
      }}
    >
      {children}
    </CampaignDetailCtx.Provider>
  );
}

export function useCampaignDetail() {
  const ctx = useContext(CampaignDetailCtx);
  if (!ctx) throw new Error("useCampaignDetail must be used inside CampaignDetailProvider");
  return ctx;
}

function templateVariablesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "").trim() !== (b[key] ?? "").trim()) return false;
  }
  return true;
}
