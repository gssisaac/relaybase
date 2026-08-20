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
import { useEmailPaths } from "@/email/lib/paths";
import {
  clearEmailCache,
  fetchEmailCachedOptional,
} from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import type {
  AudienceGroupContact,
  AudienceGroupSummary,
} from "@/email/components/mailbox/types";

export type AudienceGroupDetail = {
  group: AudienceGroupSummary;
  contacts: AudienceGroupContact[];
};

function detailResource(groupId: string): string {
  return `audience-group:${groupId}`;
}

export function clearAudienceGroupDetailCache(
  productId: string,
  groupId: string,
): void {
  clearEmailCache(productId, detailResource(groupId));
  clearEmailCache(productId, "audience-groups");
}

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

export function AudienceGroupDetailProvider({
  groupId,
  children,
}: {
  groupId: string;
  children: ReactNode;
}) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const resource = detailResource(groupId);

  const [detail, setDetail] = useState<AudienceGroupDetail | null>(null);
  const [loading, setLoading] = useState(
    () => readEmailStale<AudienceGroupDetail>(productId, resource) === null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailRef = useRef(detail);
  detailRef.current = detail;

  useEffect(() => {
    const stale = readEmailStale<AudienceGroupDetail>(productId, resource);
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
        const result = await fetchEmailCachedOptional<AudienceGroupDetail>(
          productId,
          resource,
          `${apiBase}/audience-groups/${encodeURIComponent(groupId)}`,
          { refresh: force, onUpdate: (data) => data && setDetail(data) },
        );
        if (result.ok) {
          if (result.data) setDetail(result.data);
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
    [apiBase, groupId, productId, resource],
  );

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
