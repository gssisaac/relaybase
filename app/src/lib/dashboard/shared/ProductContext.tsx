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

export function useProductApiBase(_segment: string): string {
  return "/api/email";
}

export function usePanelHref(...segments: string[]): string {
  const suffix = segments.filter(Boolean).join("/");
  return suffix ? `/${suffix}` : "/";
}

export function useReleaseApiUrl(..._segments: string[]): string {
  return "/api/email";
}
