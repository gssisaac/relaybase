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

import { studioAudienceApi } from "@/studio/api";
import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";

export type AudienceGroupDetail = {
  group: AudienceGroupSummary;
  contacts: AudienceGroupContact[];
};

type Ctx = {
  groupId: string;
  detail: AudienceGroupDetail | null;
  loading: boolean;
  refreshing: boolean;
  notFound: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

const AudienceGroupDetailCtx = createContext<Ctx | null>(null);

export function clearAudienceGroupDetailCache(_productId: string, _groupId: string): void {
  /* Studio audience is server-backed — no email cache to clear. */
}

export function AudienceGroupDetailProvider({
  groupId,
  children,
}: {
  groupId: string;
  children: ReactNode;
}) {
  const [detail, setDetail] = useState<AudienceGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailRef = useRef(detail);
  detailRef.current = detail;

  const refresh = useCallback(async (_force?: boolean) => {
    if (!detailRef.current) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const data = await studioAudienceApi.getGroup(groupId);
      setDetail(data);
      setNotFound(false);
    } catch (e) {
      const status = e && typeof e === "object" && "status" in e ? e.status : null;
      if (status === 404) {
        setNotFound(true);
        setDetail(null);
      } else {
        setError(e instanceof Error ? e.message : "Refresh failed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AudienceGroupDetailCtx.Provider
      value={{ groupId, detail, loading, refreshing, notFound, error, refresh }}
    >
      {children}
    </AudienceGroupDetailCtx.Provider>
  );
}

export function useAudienceGroupDetail(): Ctx {
  const ctx = useContext(AudienceGroupDetailCtx);
  if (!ctx) throw new Error("AudienceGroupDetailProvider required");
  return ctx;
}
