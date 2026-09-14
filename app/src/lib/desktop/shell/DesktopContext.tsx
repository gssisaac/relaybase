"use client";

import * as React from "react";

import {
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
} from "./session-cache";
import { clearAllDashboardClientCache } from "@/lib/dashboard/shared/dashboard-client-cache";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasOwnerSession } from "@/lib/desktop/auth";

type DesktopContextValue = {
  isDesktop: boolean;
  ready: boolean;
  credentials: DesktopCredentials | null;
  teamLogin: DesktopTeamLogin | null;
  /** Opaque account-scope id (`s-{16hex}`) for the current session. Changes
   * when the CF / Relaybase console account or Worker URL changes. */
  accountScopeId: string;
  refresh: () => Promise<{
    credentials: DesktopCredentials | null;
    teamLogin: DesktopTeamLogin | null;
  }>;
  setCredentials: (c: DesktopCredentials | null) => void;
};

const DesktopContext = React.createContext<DesktopContextValue | null>(null);

function applyCredentialGlobals(creds: DesktopCredentials | null) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __RELAYBASE_WORKER_URL__?: string;
  };
  if (creds?.workerUrl) {
    w.__RELAYBASE_WORKER_URL__ = creds.workerUrl;
  } else if (!hasOwnerSession()) {
    // Don't clobber the worker URL a web owner session (AccountLoginView /
    // WebInstallFlow) just set — this module has no concept of that session.
    delete w.__RELAYBASE_WORKER_URL__;
  }
}

async function loadLocalCredentials(): Promise<DesktopCredentials | null> {
  const { loadLocalCredentialsFile } = await import("@/lib/desktop/bridge/credentials-local");
  const data = await loadLocalCredentialsFile();
  if (data?.workerUrl?.trim()) return data;
  if (typeof window !== "undefined") {
    const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
    const fromGlobal = w.__RELAYBASE_WORKER_URL__?.trim();
    if (fromGlobal) {
      return {
        accountId: data?.accountId ?? "",
        installToken: data?.installToken ?? "",
        workerUrl: fromGlobal,
        workerScriptName: data?.workerScriptName || "relaybase-api",
        workerVersion: data?.workerVersion ?? "",
        relaybaseAccountId: data?.relaybaseAccountId ?? "",
        relaybaseEmail: data?.relaybaseEmail ?? "",
        relaybaseSession: data?.relaybaseSession ?? "",
        cfOauthAccessToken: "",
        cfOauthRefreshToken: "",
        cfOauthAccessExpiresAt: "",
        cfOauthAccountId: data?.cfOauthAccountId ?? "",
        scopeId: data?.scopeId ?? "",
      };
    }
  }
  return null;
}

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const cached = readDesktopSessionCache();
  // Match SSR and the first client paint — Tauri invoke is not available on the server.
  const [isDesktop, setIsDesktop] = React.useState(false);
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

  const refresh = React.useCallback(async (): Promise<{
    credentials: DesktopCredentials | null;
    teamLogin: DesktopTeamLogin | null;
  }> => {
    const desktop = isDesktopRuntime();
    setIsDesktop(desktop);
    let creds: DesktopCredentials | null = null;
    let team: DesktopTeamLogin | null = null;
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
      const webAuth = !desktop ? getWebTeamAuth() : null;
      [creds, team] = desktop
        ? await Promise.all([desktopGetCredentials(), desktopGetTeamLogin()])
        : [
            await loadLocalCredentials(),
            webAuth
              ? {
                  workerUrl: webAuth.workerUrl,
                  accountEmail: webAuth.accountEmail,
                  mobilePassword: webAuth.mobilePassword ?? "",
                }
              : null,
          ];
      setCredentials(creds);
      setTeamLogin(team);
      applyCredentialGlobals(creds ?? (webAuth ? ({ workerUrl: webAuth.workerUrl } as DesktopCredentials) : null));
      // Resolve the opaque scope id so downstream stores can detect account
      // switches. Clear the in-memory session cache on scope change so stale
      // MobX state does not bleed across accounts.
      const scopeId = desktop
        ? await desktopGetAccountScopeId()
        : (webAuth?.accountEmail || "s-legacy");
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
      creds = null;
      team = null;
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
    return { credentials: creds, teamLogin: team };
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

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
