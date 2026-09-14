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

import { crmApi, type Campaign, type CrmTemplate } from "@/lib/crm/api";

type DraftFields = { subject: string; bodyMarkdown: string; templateId: string };

type Ctx = {
  campaignId: string;
  campaign: Campaign | null;
  templates: CrmTemplate[];
  contactCount: number | null;
  contactCountHasMore: boolean;
  loading: boolean;
  notFound: boolean;
  setCampaign: (campaign: Campaign) => void;
  refresh: () => Promise<void>;
  syncDraft: (fields: DraftFields) => void;
  persistDraft: () => Promise<boolean>;
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
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [contactCountHasMore, setContactCountHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const draftRef = useRef<DraftFields>({ subject: "", bodyMarkdown: "", templateId: "" });
  const lastSaved = useRef<DraftFields | null>(null);
  const persistInFlight = useRef<Promise<boolean> | null>(null);
  const campaignRef = useRef<Campaign | null>(null);
  campaignRef.current = campaign;

  const refresh = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        crmApi.getCampaign(campaignId),
        crmApi.listTemplates(),
      ]);
      const nextTemplateId = c.templateId ?? t.templates[0]?.id ?? "";
      setCampaign(c);
      setTemplates(t.templates);
      setNotFound(false);
      const fields = {
        subject: c.subject,
        bodyMarkdown: c.bodyMarkdown,
        templateId: nextTemplateId,
      };
      draftRef.current = fields;
      lastSaved.current = fields;
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    lastSaved.current = null;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void crmApi.listContacts().then(
      (data) => {
        setContactCount(data.contacts.length);
        setContactCountHasMore(Boolean(data.nextCursor));
      },
      () => {
        setContactCount(null);
        setContactCountHasMore(false);
      },
    );
  }, []);

  const syncDraft = useCallback((fields: DraftFields) => {
    draftRef.current = fields;
  }, []);

  const persistDraft = useCallback((): Promise<boolean> => {
    const current = campaignRef.current;
    const editable = current?.status === "draft" || current?.status === "failed";
    if (!editable) return Promise.resolve(true);
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
      .updateCampaign(campaignId, next)
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
        contactCount,
        contactCountHasMore,
        loading,
        notFound,
        setCampaign,
        refresh,
        syncDraft,
        persistDraft,
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
