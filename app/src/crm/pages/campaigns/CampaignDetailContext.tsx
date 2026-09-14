"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  crmApi,
  type Broadcast,
  type Campaign,
  type CrmTemplate,
  type Subscriber,
} from "@/lib/crm/api";

type Ctx = {
  campaignId: string;
  campaign: Campaign | null;
  templates: CrmTemplate[];
  subscribers: Subscriber[];
  broadcasts: Broadcast[];
  loading: boolean;
  notFound: boolean;
  setCampaign: (campaign: Campaign) => void;
  refresh: () => Promise<void>;
  refreshSubscribers: () => Promise<void>;
  refreshBroadcasts: () => Promise<void>;
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
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refreshSubscribers = useCallback(async () => {
    const { subscribers: rows } = await crmApi.listSubscribers(campaignId);
    setSubscribers(rows);
  }, [campaignId]);

  const refreshBroadcasts = useCallback(async () => {
    const { broadcasts: rows } = await crmApi.listBroadcasts(campaignId);
    setBroadcasts(rows);
  }, [campaignId]);

  const refresh = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([crmApi.getCampaign(campaignId), crmApi.listTemplates()]);
      setCampaign(c);
      setTemplates(t.templates);
      setNotFound(false);
      await Promise.all([refreshSubscribers(), refreshBroadcasts()]);
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? err.status : null;
      if (status === 404) setNotFound(true);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, refreshSubscribers, refreshBroadcasts]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <CampaignDetailCtx.Provider
      value={{
        campaignId,
        campaign,
        templates,
        subscribers,
        broadcasts,
        loading,
        notFound,
        setCampaign,
        refresh,
        refreshSubscribers,
        refreshBroadcasts,
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
