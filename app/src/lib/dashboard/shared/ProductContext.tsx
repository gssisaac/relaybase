"use client";

import * as React from "react";

type SessionContextValue = {
  userId: string;
  basePath: string;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ userId, basePath: "" }),
    [userId],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("SessionProvider required");
  return ctx;
}

export function useProductId(): string {
  return useSession().userId;
}

/**
 * Browser/dev: Next `/api/email` proxies.
 * Desktop: point at the Worker installed in the user's CF account when
 * `window.__RELAYBASE_WORKER_URL__` is set (filled by DesktopProvider effect).
 */
export function useProductApiBase(_segment: string): string {
  if (typeof window !== "undefined") {
    const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
    if (w.__RELAYBASE_WORKER_URL__) {
      return `${w.__RELAYBASE_WORKER_URL__.replace(/\/$/, "")}/v1`;
    }
  }
  return "/api/email";
}

export function usePanelHref(...segments: string[]): string {
  const suffix = segments.filter(Boolean).join("/");
  return suffix ? `/${suffix}` : "/";
}

export function useReleaseApiUrl(..._segments: string[]): string {
  return useProductApiBase("email");
}
