"use client";

import * as React from "react";

import {
  desktopGetCredentials,
  isDesktopRuntime,
  type DesktopCredentials,
} from "@/lib/desktop/bridge";

type DesktopContextValue = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  refresh: () => Promise<void>;
  setCredentials: (c: DesktopCredentials | null) => void;
};

const DesktopContext = React.createContext<DesktopContextValue | null>(null);

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [credentials, setCredentials] =
    React.useState<DesktopCredentials | null>(null);

  const refresh = React.useCallback(async () => {
    if (!isDesktopRuntime()) {
      setIsDesktop(false);
      setCredentials(null);
      if (typeof window !== "undefined") {
        delete (window as unknown as { __RELAYBASE_WORKER_URL__?: string })
          .__RELAYBASE_WORKER_URL__;
      }
      setReady(true);
      return;
    }
    setIsDesktop(true);
    try {
      const creds = await desktopGetCredentials();
      setCredentials(creds);
      if (typeof window !== "undefined") {
        const w = window as unknown as {
          __RELAYBASE_WORKER_URL__?: string;
          __RELAYBASE_ADMIN_TOKEN__?: string;
        };
        if (creds?.workerUrl) w.__RELAYBASE_WORKER_URL__ = creds.workerUrl;
        else delete w.__RELAYBASE_WORKER_URL__;
        if (creds?.adminToken) w.__RELAYBASE_ADMIN_TOKEN__ = creds.adminToken;
        else delete w.__RELAYBASE_ADMIN_TOKEN__;
      }
    } catch {
      setCredentials(null);
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const setCredentialsAndGlobals = React.useCallback(
    (creds: DesktopCredentials | null) => {
      setCredentials(creds);
      if (typeof window === "undefined") return;
      const w = window as unknown as {
        __RELAYBASE_WORKER_URL__?: string;
        __RELAYBASE_ADMIN_TOKEN__?: string;
      };
      if (creds?.workerUrl) w.__RELAYBASE_WORKER_URL__ = creds.workerUrl;
      else delete w.__RELAYBASE_WORKER_URL__;
      if (creds?.adminToken) w.__RELAYBASE_ADMIN_TOKEN__ = creds.adminToken;
      else delete w.__RELAYBASE_ADMIN_TOKEN__;
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      isDesktop,
      ready,
      credentials,
      refresh,
      setCredentials: setCredentialsAndGlobals,
    }),
    [isDesktop, ready, credentials, refresh, setCredentialsAndGlobals],
  );

  return (
    <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>
  );
}

export function useDesktop(): DesktopContextValue {
  const ctx = React.useContext(DesktopContext);
  if (!ctx) throw new Error("DesktopProvider required");
  return ctx;
}

export function useOptionalDesktop(): DesktopContextValue | null {
  return React.useContext(DesktopContext);
}
