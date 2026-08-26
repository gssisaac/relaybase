"use client";

import * as React from "react";

import {
  desktopClearCredentials,
  desktopGetAccountScopeId,
  desktopGetCredentials,
  desktopGetTeamLogin,
  desktopMigrateMailUserFolder,
  desktopMigrateStorageLayout,
  isDesktopRuntime,
  type DesktopCredentials,
  type DesktopTeamLogin,
} from "@/lib/desktop/bridge";
import {
  clearDesktopSessionCache,
  clearScopeDependentLocalStorage,
  readDesktopSessionCache,
  writeDesktopSessionCache,
} from "@/lib/desktop/desktop-session-cache";
import { clearAllDashboardClientCache } from "@/lib/dashboard/shared/dashboard-client-cache";
import { isUnauthorizedGraceActive } from "@/lib/desktop/unauthorized-grace";

type DesktopContextValue = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  teamLogin: DesktopTeamLogin | null;
  /** Opaque account-scope id (`s-{16hex}`) for the current session. Changes
   * when the CF / Relaybase console account or Worker URL changes. */
  accountScopeId: string;
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
    if (!data?.workerUrl) return null;
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
  const [accountScopeId, setAccountScopeId] = React.useState<string>("");

  React.useLayoutEffect(() => {
    const snap = readDesktopSessionCache();
    if (snap?.credentials) applyCredentialGlobals(snap.credentials);
  }, []);

  const refresh = React.useCallback(async () => {
    const desktop = isDesktopRuntime();
    setIsDesktop(desktop);
    try {
      // Run the flat→scoped layout migration BEFORE loading credentials so
      // the scope id is stable when mail/cache stores hydrate. Best-effort.
      if (desktop) {
        try {
          await desktopMigrateMailUserFolder();
          await desktopMigrateStorageLayout();
        } catch {
          /* best-effort one-shot */
        }
      }
      const [creds, team] = desktop
        ? await Promise.all([desktopGetCredentials(), desktopGetTeamLogin()])
        : [await loadLocalCredentials(), null];
      setCredentials(creds);
      setTeamLogin(team);
      applyCredentialGlobals(creds);
      // Resolve the opaque scope id so downstream stores can detect account
      // switches. Clear the in-memory session cache on scope change so stale
      // MobX state does not bleed across accounts.
      const scopeId = desktop ? await desktopGetAccountScopeId() : "s-legacy";
      setAccountScopeId((prev) => {
        if (prev && prev !== scopeId) {
          clearDesktopSessionCache();
          clearScopeDependentLocalStorage();
          clearAllDashboardClientCache();
        }
        return scopeId;
      });
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
  }, [refresh]);

  // Global 401 handler: when the Worker rejects the admin token, clear
  // credentials and redirect to /setup so the user can re-connect.
  React.useEffect(() => {
    async function onUnauthorized() {
      if (isUnauthorizedGraceActive()) return;
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
      accountScopeId,
      refresh,
      setCredentials: setCredentialsAndGlobals,
    }),
    [isDesktop, ready, credentials, teamLogin, accountScopeId, refresh, setCredentialsAndGlobals],
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
