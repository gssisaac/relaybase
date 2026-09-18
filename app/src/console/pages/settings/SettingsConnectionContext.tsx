"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { type HealthTone } from "@/lib/dashboard/connection-status";
import {
  cfDomainApiReady,
  setCfApiTokenUserConfirmed,
} from "@/lib/dashboard/cf-api-token-user-confirmed";
import { useConnectionStatus } from "@/lib/dashboard/use-connection-status";
import {
  desktopGetCredentials,
  desktopPushServerToken,
  saveUserConnection,
  desktopStartCfOAuth,
  listenCfOAuthResult,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  desktopOpenExternal,
  cfTokenPermissionProbeWarningHelp,
  explainDesktopError,
  explainCfOAuthError,
  isCloudflareAuthExpired,
  cfApiTokenHealth,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { registerEnableEmailApiPasteBridge } from "@/console/components/setup/common/update/use-enable-email-api-dialog";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import {
  fetchWebCfOAuthSessionPresent,
  PENDING_SERVER_TOKEN_PUSH_KEY,
} from "@/lib/desktop/bridge/web-oauth-complete";
import { useWebCfOAuthComplete } from "@/lib/desktop/bridge/use-web-cf-oauth-complete";
import { openWebCfOAuthPopup } from "@/lib/desktop/bridge/web-oauth-authorize";

type HealthBlock = { tone: HealthTone; label: string; detail: string };

type SettingsConnectionContextValue = {
  credentials: DesktopCredentials | null;
  refreshCredentials: () => Promise<void>;
  workerStatus: NonNullable<
    ReturnType<typeof useConnectionStatus>["snapshot"]
  >["worker"];
  cfConnected: boolean;
  statusBusy: boolean;
  hasWorker: boolean;
  workerHealth: HealthBlock;
  r2Health: HealthBlock;
  d1Health: HealthBlock;
  logsOk: boolean;
  searchOk: boolean;
  appOk: boolean;
  accountId: string;
  setAccountId: (value: string) => void;
  workerUrl: string;
  setWorkerUrl: (value: string) => void;
  cfEditing: boolean;
  setCfEditing: (value: boolean) => void;
  workerEditing: boolean;
  setWorkerEditing: (value: boolean) => void;
  cfBusy: boolean;
  serverPushBusy: boolean;
  workerBusy: boolean;
  cfError: DesktopErrorHelp | null;
  cfWarning: DesktopErrorHelp | null;
  cfHealth: HealthBlock;
  workerError: DesktopErrorHelp | null;
  cfMessage: string | null;
  workerMessage: string | null;
  // CF OAuth (install token) — push-time authorize flow
  cfInstallTokenAvailable: boolean;
  oauthBusy: boolean;
  oauthError: DesktopErrorHelp | null;
  handleStartCfOAuth: () => Promise<void>;
  resetCfDraft: () => void;
  resetWorkerDraft: () => void;
  handleSaveServerToken: () => Promise<void>;
  handlePasteServerToken: (token: string) => Promise<boolean>;
  handleSaveWorker: () => Promise<void>;
  handleVerifyCf: () => Promise<boolean>;
  handleConfirmCfSetup: () => Promise<void>;
  handleRefreshStatus: () => Promise<void>;
};

const SettingsConnectionContext =
  createContext<SettingsConnectionContextValue | null>(null);

export function useSettingsConnection() {
  const ctx = useContext(SettingsConnectionContext);
  if (!ctx) {
    throw new Error("useSettingsConnection requires SettingsConnectionProvider");
  }
  return ctx;
}

export function SettingsConnectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;
  const [webCfOauthPresent, setWebCfOauthPresent] = useState(false);
  const refreshCredentials = async (): Promise<void> => {
    await desktop?.refresh?.();
  };
  const {
    snapshot,
    loading: statusLoading,
    refreshing: statusRefreshing,
    refresh: refreshConnectionStatus,
  } = useConnectionStatus();

  const workerStatus = snapshot?.worker ?? null;
  // The Worker's CF_API_TOKEN secret is the source of truth for whether
  // the domain / routing API is configured. Worker CF_ACCOUNT_ID is not
  // required. Device-local storage is not a management signal.
  // When the probe has run, use it; fall back to the local signal only when
  // the probe can't run (no worker status yet).
  const cfConnected = workerStatus
    ? cfDomainApiReady(workerStatus, credentials)
    : Boolean(snapshot?.cfConnected);
  const statusBusy = statusLoading || statusRefreshing;

  const [accountId, setAccountId] = useState("");
  const [serverToken, setServerToken] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");

  const [cfEditing, setCfEditing] = useState(false);
  const [workerEditing, setWorkerEditing] = useState(false);

  const [cfBusy, setCfBusy] = useState(false);
  const [serverPushBusy, setServerPushBusy] = useState(false);
  const [workerBusy, setWorkerBusy] = useState(false);

  const [cfError, setCfError] = useState<DesktopErrorHelp | null>(null);
  const [cfWarning, setCfWarning] = useState<DesktopErrorHelp | null>(null);
  const [workerError, setWorkerError] = useState<DesktopErrorHelp | null>(null);
  const [cfMessage, setCfMessage] = useState<string | null>(null);
  const [workerMessage, setWorkerMessage] = useState<string | null>(null);

  // CF OAuth (install token) state. Used internally for the push-time
  // authorize flow — not a persistent connection.
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<DesktopErrorHelp | null>(null);
  // The state minted by the most recent `start_cf_oauth`. The deep-link
  // handler only accepts a callback whose state matches this (CSRF + guards
  // against stale cold-start links).
  const oauthStartStateRef = useRef<string | null>(null);
  // Set when the user clicked "Verify, save & push" without an install token
  // in memory. After OAuth completes, the onComplete handler runs the push.
  const pendingPushRef = useRef(false);
  // Mirror of the server-token draft so the OAuth onComplete callback (which
  // closes over mount-time state) can read the latest typed value.
  const serverTokenRef = useRef("");

  useEffect(() => {
    if (isDesktopRuntime()) return;
    void fetchWebCfOAuthSessionPresent().then(setWebCfOauthPresent);
  }, [credentials]);

  // OAuth session in memory (desktop) or sealed cookie (web). Gates server-token push.
  const cfInstallTokenAvailable = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim() ||
      webCfOauthPresent,
  );

  function resetCfDraft() {
    setAccountId(credentials?.accountId ?? "");
    setServerToken("");
    setCfError(null);
    setCfWarning(null);
    setCfMessage(null);
  }

  function resetWorkerDraft() {
    setWorkerUrl(credentials?.workerUrl ?? "");
    setWorkerError(null);
    setWorkerMessage(null);
  }

  useEffect(() => {
    serverTokenRef.current = serverToken;
  }, [serverToken]);

  useEffect(() => {
    if (!cfEditing) {
      setAccountId(credentials?.accountId ?? "");
    }
    if (!workerEditing) {
      setWorkerUrl(credentials?.workerUrl ?? "");
    }
  }, [credentials, cfEditing, workerEditing]);

  useEffect(() => {
    if (!credentials) return;
    // The Cloudflare tab no longer auto-opens an edit form. The OAuth
    // "Connect with Cloudflare" button is the primary CTA when no install
    // token is present; the server-token form is opened manually.
  }, [credentials]);

  async function runServerTokenPush(override?: {
    accountId?: string;
    serverToken?: string;
  }) {
    setCfBusy(true);
    setServerPushBusy(true);
    setCfError(null);
    setCfMessage(null);
    try {
      const token = override?.serverToken ?? serverToken;
      // Account id comes from the CF OAuth flow (stored in credentials).
      // Fall back to the draft only for legacy/manual setups.
      const acctId =
        override?.accountId?.trim() ||
        credentials?.accountId?.trim() ||
        accountId.trim();
      if (!acctId) {
        throw new Error(
          "Authorize with Cloudflare first to push the server token.",
        );
      }
      const result = await desktopVerifyCfToken(acctId, token, "server");
      if (!result.ok) throw new Error(result.message);
      const push = await desktopPushServerToken(token);
      if (!push.ok) throw new Error(push.message);
      setCfMessage(
        push.pushedAt
          ? "Server token verified and pushed to the Worker."
          : "Server token verified.",
      );
      setServerToken("");
      await refreshCredentials();
      await refreshConnectionStatus();
      setCfEditing(false);
      return true;
    } catch (err) {
      if (isCloudflareAuthExpired(err)) return "expired";
      setCfError(explainDesktopError(err, "Server token verification failed"));
      return false;
    } finally {
      setCfBusy(false);
      setServerPushBusy(false);
    }
  }

  async function authorizeThenPush() {
    pendingPushRef.current = true;
    if (!isDesktopRuntime() && serverTokenRef.current.trim()) {
      try {
        sessionStorage.setItem(
          PENDING_SERVER_TOKEN_PUSH_KEY,
          serverTokenRef.current.trim(),
        );
      } catch {
        /* ignore */
      }
    }
    setCfError(null);
    setCfMessage("Authorize with Cloudflare to push the server token.");
    await handleStartCfOAuth();
  }

  async function handleSaveServerToken() {
    // No install token in memory or on disk: request a short-lived Cloudflare
    // authorization (memory only — cleared on app restart). After OAuth
    // completes, the pending-push effect runs the push automatically.
    if (!cfInstallTokenAvailable) {
      await authorizeThenPush();
      return;
    }
    const result = await runServerTokenPush();
    if (result === "expired") await authorizeThenPush();
  }

  async function handlePasteServerToken(token: string): Promise<boolean> {
    setServerToken(token);
    if (!cfInstallTokenAvailable) {
      await authorizeThenPush();
      return false;
    }
    const result = await runServerTokenPush({ serverToken: token });
    if (result === "expired") {
      await authorizeThenPush();
      return false;
    }
    if (!result) {
      throw new Error("Server token verification failed");
    }
    return true;
  }

  // Rust completes OAuth (localhost:32831 in tauri:dev, or relaybase:// in
  // a bundled app) and emits cf-oauth-complete / cf-oauth-error.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;
    listenCfOAuthResult({
      onComplete: () => {
        if (!active) return;
        oauthStartStateRef.current = null;
        void (async () => {
          await refreshCredentials();
          await refreshConnectionStatus();
          setOauthBusy(false);
          setOauthError(null);
          // If the user clicked "Verify, save & push" without an install
          // token, run the deferred push now that OAuth populated the
          // in-memory install token + account id.
          if (pendingPushRef.current) {
            pendingPushRef.current = false;
            const fresh = await desktopGetCredentials();
            await runServerTokenPush({
              accountId: fresh?.accountId,
              serverToken: serverTokenRef.current,
            });
          }
        })();
      },
      onError: (message) => {
        if (!active) return;
        pendingPushRef.current = false;
        setOauthError(explainCfOAuthError(message));
        setOauthBusy(false);
      },
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runServerTokenPushRef = useRef(runServerTokenPush);
  runServerTokenPushRef.current = runServerTokenPush;

  const completeWebCfOAuth = async () => {
    setWebCfOauthPresent(await fetchWebCfOAuthSessionPresent());
    await refreshCredentials();
    await refreshConnectionStatus();
    setOauthBusy(false);
    setOauthError(null);
    if (!pendingPushRef.current) return;
    pendingPushRef.current = false;
    const pendingToken =
      sessionStorage.getItem(PENDING_SERVER_TOKEN_PUSH_KEY)?.trim() ||
      serverTokenRef.current;
    sessionStorage.removeItem(PENDING_SERVER_TOKEN_PUSH_KEY);
    if (pendingToken) setServerToken(pendingToken);
    const fresh = await desktopGetCredentials();
    await runServerTokenPushRef.current({
      accountId: fresh?.accountId ?? fresh?.cfOauthAccountId,
      serverToken: pendingToken,
    });
  };

  useWebCfOAuthComplete(() => {
    void completeWebCfOAuth();
  });

  async function handleStartCfOAuth() {
    setOauthBusy(true);
    setOauthError(null);
    try {
      const returnTo = pathname.startsWith("/settings") ? pathname : undefined;
      const start = await desktopStartCfOAuth("install", returnTo);
      oauthStartStateRef.current = start.state;
      if (!isDesktopRuntime() && start.authorizeUrl.startsWith("/")) {
        openWebCfOAuthPopup(start.authorizeUrl, {
          onComplete: () => {
            void completeWebCfOAuth();
          },
          onError: (message) => {
            setOauthError(explainCfOAuthError(message));
            setOauthBusy(false);
          },
        });
        return;
      }
      await desktopOpenExternal(start.authorizeUrl);
    } catch (err) {
      setOauthError(explainCfOAuthError(err));
      setOauthBusy(false);
    }
  }

  async function handleSaveWorker() {
    setWorkerBusy(true);
    setWorkerError(null);
    setWorkerMessage(null);
    try {
      const result = await desktopVerifyWorkerConnection(workerUrl);
      await saveUserConnection({
        workerUrl: result.workerUrl,
        accountId: result.accountId,
        workerScriptName: result.workerScriptName,
        workerVersion: result.version,
      });
      setWorkerMessage(`Connected to ${result.workerUrl}`);
      await refreshCredentials();
      await refreshConnectionStatus();
      setWorkerEditing(false);
    } catch (err) {
      setWorkerError(explainDesktopError(err, "Could not verify Worker"));
    } finally {
      setWorkerBusy(false);
    }
  }

  async function handleVerifyCf(): Promise<boolean> {
    const url = credentials?.workerUrl?.trim() || workerUrl.trim();
    if (!url) {
      setCfError({
        title: "Worker not connected",
        detail: "Save a Worker URL first.",
        fix: "Go to the Routing Worker tab and configure your Worker URL, then verify.",
      });
      return false;
    }
    setCfBusy(true);
    setCfError(null);
    setCfWarning(null);
    setCfMessage(null);
    try {
      const result = await desktopVerifyWorkerConnection(url);
      if (!result.cfApiTokenSet) {
        setCfError({
          title: "API token not configured",
          detail: "The Worker has no CF_API_TOKEN secret configured yet.",
          fix: "Add CF_API_TOKEN under Worker settings → Runtime variables and secrets, or click Set up again.",
        });
        await refreshConnectionStatus();
        return false;
      }
      if (result.cfApiTokenValid === false) {
        setCfWarning(
          cfTokenPermissionProbeWarningHelp(result.cfApiTokenPermissions, {
            workerVersion: result.version,
          }),
        );
        await refreshConnectionStatus();
        return false;
      }
      if (result.cfApiTokenValid !== true && result.cfApiTokenSet) {
        setCfMessage(
          "Cloudflare API token is set on the Worker. Automatic permission check was inconclusive.",
        );
        await refreshCredentials();
        await refreshConnectionStatus();
        return true;
      }
      await setCfApiTokenUserConfirmed(url, true);
      setCfMessage("Cloudflare API token and permissions verified successfully.");
      await refreshCredentials();
      await refreshConnectionStatus();
      return true;
    } catch (err) {
      setCfError(
        explainDesktopError(err, "Could not verify Cloudflare API token"),
      );
      await refreshConnectionStatus().catch(() => {});
      return false;
    } finally {
      setCfBusy(false);
    }
  }

  async function handleConfirmCfSetup(): Promise<void> {
    const url = credentials?.workerUrl?.trim() || workerUrl.trim();
    if (!url) return;
    setCfBusy(true);
    setCfError(null);
    try {
      await setCfApiTokenUserConfirmed(url, true);
      setCfWarning(null);
      setCfMessage(
        "Saved as configured. Relaybase will treat Cloudflare API setup as complete on this Mac; API errors at runtime still mean the token needs fixing.",
      );
      await refreshCredentials();
      await refreshConnectionStatus();
    } finally {
      setCfBusy(false);
    }
  }

  async function handleRefreshStatus() {
    const url = credentials?.workerUrl?.trim() || workerUrl.trim();
    if (!url) {
      setWorkerError({
        title: "Worker not connected",
        detail: "Save a Worker URL first.",
        fix: "Paste your workers.dev URL, then verify with your owner session.",
      });
      return;
    }
    setWorkerError(null);
    setCfError(null);
    setCfWarning(null);
    setCfMessage(null);
    await refreshConnectionStatus();
  }

  const cfHealth: HealthBlock = cfConnected
    ? workerStatus?.cfApiTokenValid === false
      ? {
          tone: "warn",
          label: "Configured (you confirmed)",
          detail:
            "You marked setup complete. Relaybase’s automatic check did not pass — fix the token if domain or routing calls fail.",
        }
      : {
          tone: "ok",
          label: "Configured",
          detail:
            "The API token is set on the Worker and Cloudflare accepted it.",
        }
    : statusBusy && !workerStatus
      ? {
          tone: "pending",
          label: "Verifying API token…",
          detail: "Probing Cloudflare API token permissions on the Worker.",
        }
      : workerStatus?.cfApiTokenSet && workerStatus.cfApiTokenValid === false
        ? {
            tone: "warn",
            label: "Automatic check did not pass",
            detail:
              "CF_API_TOKEN is on the Worker, but Relaybase’s probe disagrees. Review the warning below and mark setup complete if you finished in Cloudflare.",
          }
        : (() => {
            const health = cfApiTokenHealth(workerStatus, { pending: cfBusy });
            return {
              tone:
                health.tone === "bad"
                  ? ("bad" as HealthTone)
                  : health.tone === "pending"
                    ? ("pending" as HealthTone)
                    : ("bad" as HealthTone),
              label: health.label,
              detail: health.detail,
            };
          })();

  const hasWorker = Boolean(
    credentials?.workerUrl?.trim() ||
      (typeof window !== "undefined" &&
        (window as unknown as { __RELAYBASE_WORKER_URL__?: string })
          .__RELAYBASE_WORKER_URL__?.trim()),
  );
  const logsOk = workerStatus?.d1Logs?.configured === true;
  const searchOk = workerStatus?.d1Mail?.configured === true;
  const appOk = workerStatus?.d1App?.configured === true;

  const workerHealth: HealthBlock = !hasWorker
    ? {
        tone: "bad",
        label: "Not connected",
        detail:
          "No Worker URL saved. Deploy the install ZIP, then verify with your owner session.",
      }
    : statusBusy && !workerStatus
      ? {
          tone: "pending",
          label: "Checking connection…",
          detail: "Probing GET /console/connect on your Worker.",
        }
      : workerStatus?.ok
        ? {
            tone: "ok",
            label: "Connected — healthy",
            detail:
              "Worker is reachable and your owner session is accepted. No connection problems detected.",
          }
        : {
            tone: "bad",
            label: "Unreachable or unhealthy",
            detail:
              "Could not verify the Worker. Check the URL, owner session, and that the deploy is live.",
          };

  const r2Health: HealthBlock = !hasWorker
    ? {
        tone: "bad",
        label: "Unavailable",
        detail: "Connect a routing Worker first to check inbound R2.",
      }
    : statusBusy && !workerStatus
      ? {
          tone: "pending",
          label: "Checking R2…",
          detail: "Listing the inbound bucket through the Worker binding.",
        }
      : workerStatus?.r2Configured
        ? {
            tone: "ok",
            label: "Configured — healthy",
            detail: "Inbound R2 binding works. Raw email storage is ready.",
          }
        : {
            tone: "bad",
            label: "Not configured",
            detail:
              "Create the R2 bucket, bind it as INBOUND in wrangler.toml, redeploy, then refresh.",
          };

  const d1Health: HealthBlock = !hasWorker
    ? {
        tone: "bad",
        label: "Unavailable",
        detail: "Connect a routing Worker first to check D1.",
      }
    : statusBusy && !workerStatus
      ? {
          tone: "pending",
          label: "Checking D1…",
          detail: "Probing ops log, inbox search, and product DB bindings.",
        }
      : logsOk && searchOk && appOk
        ? {
            tone: "ok",
            label: "Configured — healthy",
            detail: "Ops log, mail index, and product DB tables are reachable.",
          }
        : logsOk && searchOk
          ? {
              tone: "ok",
              label: "Logs + search configured",
              detail:
                "RELAYBASE_LOGS + RELAYBASE_MAIL work. Bind RELAYBASE_DB for product state.",
            }
        : logsOk
          ? {
              tone: "ok",
              label: "Logs configured",
              detail:
                "RELAYBASE_LOGS works. Bind RELAYBASE_MAIL and RELAYBASE_DB.",
            }
        : searchOk
          ? {
              tone: "ok",
              label: "Search configured",
              detail:
                "RELAYBASE_MAIL works. Bind RELAYBASE_LOGS and RELAYBASE_DB.",
            }
        : appOk
            ? {
                tone: "ok",
                label: "Product DB configured",
                detail:
                  "RELAYBASE_DB works. Bind RELAYBASE_LOGS and RELAYBASE_MAIL.",
                }
              : {
                  tone: "bad",
                  label: "Not configured",
                  detail:
                    "Create the D1 databases, bind them in wrangler.toml, apply migrations, redeploy, then refresh.",
                };

  const value = useMemo<SettingsConnectionContextValue>(
    () => ({
      credentials,
      refreshCredentials,
      workerStatus,
      cfConnected,
      statusBusy,
      hasWorker,
      workerHealth,
      r2Health,
      d1Health,
      logsOk,
      searchOk,
      appOk,
      accountId,
      setAccountId,
      workerUrl,
      setWorkerUrl,
      cfEditing,
      setCfEditing,
      workerEditing,
      setWorkerEditing,
      cfBusy,
      serverPushBusy,
      workerBusy,
      cfError,
      cfWarning,
      cfHealth,
      workerError,
      cfMessage,
      workerMessage,
      cfInstallTokenAvailable,
      oauthBusy,
      oauthError,
      handleStartCfOAuth,
      resetCfDraft,
      resetWorkerDraft,
      handleSaveServerToken,
      handlePasteServerToken,
      handleSaveWorker,
      handleVerifyCf,
      handleConfirmCfSetup,
      handleRefreshStatus,
    }),
    [
      credentials,
      refreshCredentials,
      workerStatus,
      cfConnected,
      statusBusy,
      hasWorker,
      workerHealth,
      r2Health,
      d1Health,
      logsOk,
      searchOk,
      appOk,
      accountId,
      workerUrl,
      cfEditing,
      workerEditing,
      cfBusy,
      serverPushBusy,
      workerBusy,
      cfError,
      cfWarning,
      cfHealth,
      workerError,
      cfMessage,
      workerMessage,
      cfInstallTokenAvailable,
      oauthBusy,
      oauthError,
    ],
  );

  useEffect(() => {
    registerEnableEmailApiPasteBridge({
      handlePasteAndPush: value.handlePasteServerToken,
      pasteBusy: value.cfBusy || value.serverPushBusy,
      pasteError: isCloudflareAuthExpired(value.cfError ?? value.oauthError)
        ? null
        : (value.cfError ?? value.oauthError),
      pasteMessage: value.cfMessage,
      cfInstallTokenAvailable: value.cfInstallTokenAvailable,
      oauthBusy: value.oauthBusy,
    });
    return () => registerEnableEmailApiPasteBridge(null);
  }, [value]);

  return (
    <SettingsConnectionContext.Provider value={value}>
      {children}
    </SettingsConnectionContext.Provider>
  );
}
