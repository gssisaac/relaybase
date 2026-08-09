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

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useEmailPaths } from "@/email/paths";
import {
  clearEmailCache,
  fetchEmailCachedOptional,
} from "@/email/components/email-cached-fetch";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import type { BroadcastDetail } from "@/email/components/types";

function detailResource(broadcastId: string): string {
  return `broadcast:${broadcastId}`;
}

export function clearBroadcastDetailCache(
  productId: string,
  broadcastId: string,
): void {
  clearEmailCache(productId, detailResource(broadcastId));
  clearEmailCache(productId, "broadcasts:all");
}

type Ctx = {
  broadcastId: string;
  detail: BroadcastDetail | null;
  loading: boolean;
  refreshing: boolean;
  notFound: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

const BroadcastDetailCtx = createContext<Ctx | null>(null);

export function BroadcastDetailProvider({
  broadcastId,
  children,
}: {
  broadcastId: string;
  children: ReactNode;
}) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const resource = detailResource(broadcastId);

  const [detail, setDetail] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(
    () => readEmailStale<BroadcastDetail>(productId, resource) === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailRef = useRef(detail);
  detailRef.current = detail;

  useEffect(() => {
    const stale = readEmailStale<BroadcastDetail>(productId, resource);
    if (stale) {
      setDetail(stale);
      setLoading(false);
    }
  }, [productId, resource]);

  const refresh = useCallback(
    async (force?: boolean) => {
      if (!detailRef.current) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const result = await fetchEmailCachedOptional<BroadcastDetail>(
          productId,
          resource,
          `${apiBase}/broadcasts/${encodeURIComponent(broadcastId)}`,
          { refresh: force, onUpdate: (data) => data && setDetail(data) },
        );
        if (result.ok) {
          if (result.data) setDetail(result.data);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiBase, broadcastId, productId, resource],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BroadcastDetailCtx.Provider
      value={{
        broadcastId,
        detail,
        loading,
        refreshing,
        notFound,
        error,
        refresh,
      }}
    >
      {children}
    </BroadcastDetailCtx.Provider>
  );
}

export function useBroadcastDetail(): Ctx {
  const ctx = useContext(BroadcastDetailCtx);
  if (!ctx) throw new Error("BroadcastDetailProvider required");
  return ctx;
}
