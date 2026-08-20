"use client";

import * as React from "react";

import {
  desktopClearCredentials,
  desktopGetCredentials,
  desktopGetTeamLogin,
  desktopMigrateMailUserFolder,
  isDesktopRuntime,
  type DesktopCredentials,
  type DesktopTeamLogin,
} from "@/lib/desktop/bridge";
import {
  readDesktopSessionCache,
  writeDesktopSessionCache,
} from "@/lib/desktop/desktop-session-cache";

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
  const cached = readDesktopSessionCache();
  const [isDesktop, setIsDesktop] = React.useState(
    () => cached?.isDesktop ?? isDesktopRuntime(),
  );
  const [ready, setReady] = React.useState(() => cached?.ready ?? false);
  const [credentials, setCredentials] = React.useState<DesktopCredentials | null>(
    () => cached?.credentials ?? null,
  );
  const [teamLogin, setTeamLogin] = React.useState<DesktopTeamLogin | null>(
    () => cached?.teamLogin ?? null,
  );

  React.useLayoutEffect(() => {
    const snap = readDesktopSessionCache();
    if (snap?.credentials) applyCredentialGlobals(snap.credentials);
  }, []);

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
      writeDesktopSessionCache({
        isDesktop: desktop,
        ready: true,
        credentials: creds,
        teamLogin: team,
      });
    } catch {
      setCredentials(null);
      setTeamLogin(null);
      applyCredentialGlobals(null);
      writeDesktopSessionCache({
        isDesktop: desktop,
        ready: true,
        credentials: null,
        teamLogin: null,
      });
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

  // Global 401 handler: when the Worker rejects the admin token, clear
  // credentials and redirect to /setup so the user can re-connect.
  React.useEffect(() => {
    async function onUnauthorized() {
      setCredentials(null);
      applyCredentialGlobals(null);
      const snap = readDesktopSessionCache();
      writeDesktopSessionCache({
        isDesktop: snap?.isDesktop ?? isDesktopRuntime(),
        ready: true,
        credentials: null,
        teamLogin: snap?.teamLogin ?? null,
      });
      try {
        await desktopClearCredentials();
      } catch {
        /* best-effort — redirect anyway */
      }
      if (typeof window !== "undefined") {
        window.location.replace("/setup");
      }
    }
    window.addEventListener("relaybase:unauthorized", onUnauthorized);
    return () => window.removeEventListener("relaybase:unauthorized", onUnauthorized);
  }, []);

  const setCredentialsAndGlobals = React.useCallback(
    (creds: DesktopCredentials | null) => {
      setCredentials(creds);
      applyCredentialGlobals(creds);
      const snap = readDesktopSessionCache();
      writeDesktopSessionCache({
        isDesktop: snap?.isDesktop ?? isDesktopRuntime(),
        ready: true,
        credentials: creds,
        teamLogin: snap?.teamLogin ?? null,
      });
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
