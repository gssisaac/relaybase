"use client";

import * as React from "react";

import {
  desktopGetCredentials,
  desktopGetTeamLogin,
  desktopMigrateMailUserFolder,
  isDesktopRuntime,
  type DesktopCredentials,
  type DesktopTeamLogin,
} from "@/lib/desktop/bridge";

type DesktopContextValue = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  teamLogin: DesktopTeamLogin | null;
  refresh: () => Promise<void>;
  setCredentials: (c: DesktopCredentials | null) => void;
};

const DesktopContext = React.createContext<DesktopContextValue | null>(null);

function applyCredentialGlobals(creds: DesktopCredentials | null) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __RELAYBASE_WORKER_URL__?: string;
    __RELAYBASE_ADMIN_TOKEN__?: string;
  };
  if (creds?.workerUrl) w.__RELAYBASE_WORKER_URL__ = creds.workerUrl;
  else delete w.__RELAYBASE_WORKER_URL__;
  if (creds?.adminToken) w.__RELAYBASE_ADMIN_TOKEN__ = creds.adminToken;
  else delete w.__RELAYBASE_ADMIN_TOKEN__;
}

async function loadLocalCredentials(): Promise<DesktopCredentials | null> {
  try {
    const res = await fetch("/api/local-credentials", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as DesktopCredentials | null;
    if (!data?.workerUrl || !data?.adminToken) return null;
    return data;
  } catch {
    return null;
  }
}

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [credentials, setCredentials] =
    React.useState<DesktopCredentials | null>(null);
  const [teamLogin, setTeamLogin] = React.useState<DesktopTeamLogin | null>(
    null,
  );

  const refresh = React.useCallback(async () => {
    const desktop = isDesktopRuntime();
    setIsDesktop(desktop);
    try {
      const [creds, team] = desktop
        ? await Promise.all([desktopGetCredentials(), desktopGetTeamLogin()])
        : [await loadLocalCredentials(), null];
      setCredentials(creds);
      setTeamLogin(team);
      applyCredentialGlobals(creds);
    } catch {
      setCredentials(null);
      setTeamLogin(null);
      applyCredentialGlobals(null);
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    void desktopMigrateMailUserFolder().catch(() => {
      /* best-effort one-shot */
    });
  }, [refresh]);

  const setCredentialsAndGlobals = React.useCallback(
    (creds: DesktopCredentials | null) => {
      setCredentials(creds);
      applyCredentialGlobals(creds);
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      isDesktop,
      ready,
      credentials,
      teamLogin,
      refresh,
      setCredentials: setCredentialsAndGlobals,
    }),
    [isDesktop, ready, credentials, teamLogin, refresh, setCredentialsAndGlobals],
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
