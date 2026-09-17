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

import { studioSubscriberApi } from "@/studio/api";
import type {
  SubscriberGroupContact,
  SubscriberGroupSummary,
} from "@/email/components/mailbox/types";

export type SubscriberGroupDetail = {
  group: SubscriberGroupSummary;
  contacts: SubscriberGroupContact[];
};

type Ctx = {
  groupId: string;
  detail: SubscriberGroupDetail | null;
  loading: boolean;
  refreshing: boolean;
  notFound: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

const SubscriberGroupDetailCtx = createContext<Ctx | null>(null);

export function clearSubscriberGroupDetailCache(_productId: string, _groupId: string): void {
  /* Studio subscribers are server-backed — no email cache to clear. */
}

export function SubscriberGroupDetailProvider({
  groupId,
  children,
}: {
  groupId: string;
  children: ReactNode;
}) {
  const [detail, setDetail] = useState<SubscriberGroupDetail | null>(null);
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
      const data = await studioSubscriberApi.getGroup(groupId);
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
    <SubscriberGroupDetailCtx.Provider
      value={{ groupId, detail, loading, refreshing, notFound, error, refresh }}
    >
      {children}
    </SubscriberGroupDetailCtx.Provider>
  );
}

export function useSubscriberGroupDetail(): Ctx {
  const ctx = useContext(SubscriberGroupDetailCtx);
  if (!ctx) throw new Error("SubscriberGroupDetailProvider required");
  return ctx;
}
