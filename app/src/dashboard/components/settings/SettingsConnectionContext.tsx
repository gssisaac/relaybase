"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  cfConnectedFromCredentials,
  type HealthTone,
} from "@/lib/dashboard/connection-status";
import { useConnectionStatus } from "@/lib/dashboard/use-connection-status";
import {
  desktopRecoverAdminToken,
  desktopRequestAdminRecoveryToken,
  desktopSaveCfCredentials,
  desktopSaveWorkerConnection,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import type { DesktopCredentials } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

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
  accountId: string;
  setAccountId: (value: string) => void;
  apiToken: string;
  setApiToken: (value: string) => void;
  workerUrl: string;
  setWorkerUrl: (value: string) => void;
  adminToken: string;
  setAdminToken: (value: string) => void;
  cfEditing: boolean;
  setCfEditing: (value: boolean) => void;
  workerEditing: boolean;
  setWorkerEditing: (value: boolean) => void;
  cfBusy: boolean;
  workerBusy: boolean;
  cfError: DesktopErrorHelp | null;
  workerError: DesktopErrorHelp | null;
  cfMessage: string | null;
  workerMessage: string | null;
  recoveryToken: string;
  setRecoveryToken: (value: string) => void;
  newAdminToken: string;
  setNewAdminToken: (value: string) => void;
  recoveryBusy: boolean;
  recoveryError: DesktopErrorHelp | null;
  recoveryMessage: string | null;
  resetCfDraft: () => void;
  resetWorkerDraft: () => void;
  handleSaveCf: () => Promise<void>;
  handleSaveWorker: () => Promise<void>;
  handleRefreshStatus: () => Promise<void>;
  handleRequestRecoveryToken: () => Promise<void>;
  handleRecoverAdmin: () => Promise<void>;
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
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;
  const refreshCredentials = desktop?.refresh ?? (async () => undefined);
  const {
    snapshot,
    loading: statusLoading,
    refreshing: statusRefreshing,
    refresh: refreshConnectionStatus,
  } = useConnectionStatus();

  const workerStatus = snapshot?.worker ?? null;
  const cfConnected =
    snapshot?.cfConnected ?? cfConnectedFromCredentials(credentials);
  const statusBusy = statusLoading || statusRefreshing;

  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");
  const [adminToken, setAdminToken] = useState("");

  const [cfEditing, setCfEditing] = useState(false);
  const [workerEditing, setWorkerEditing] = useState(false);

  const [cfBusy, setCfBusy] = useState(false);
  const [workerBusy, setWorkerBusy] = useState(false);

  const [cfError, setCfError] = useState<DesktopErrorHelp | null>(null);
  const [workerError, setWorkerError] = useState<DesktopErrorHelp | null>(null);
  const [cfMessage, setCfMessage] = useState<string | null>(null);
  const [workerMessage, setWorkerMessage] = useState<string | null>(null);

  const [recoveryToken, setRecoveryToken] = useState("");
  const [newAdminToken, setNewAdminToken] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] =
    useState<DesktopErrorHelp | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  function resetCfDraft() {
    setAccountId(credentials?.accountId ?? "");
    setApiToken(credentials?.apiToken ?? "");
    setCfError(null);
    setCfMessage(null);
  }

  function resetWorkerDraft() {
    setWorkerUrl(credentials?.workerUrl ?? "");
    setAdminToken(credentials?.adminToken ?? "");
    setWorkerError(null);
    setWorkerMessage(null);
  }

  useEffect(() => {
    if (!cfEditing) {
      setAccountId(credentials?.accountId ?? "");
      setApiToken(credentials?.apiToken ?? "");
    }
    if (!workerEditing) {
      setWorkerUrl(credentials?.workerUrl ?? "");
      setAdminToken(credentials?.adminToken ?? "");
    }
  }, [credentials, cfEditing, workerEditing]);

  useEffect(() => {
    if (!credentials) return;
    if (!credentials.accountId?.trim() || !credentials.apiToken?.trim()) {
      setCfEditing(true);
    }
  }, [credentials]);

  async function handleSaveCf() {
    setCfBusy(true);
    setCfError(null);
    setCfMessage(null);
    try {
      const result = await desktopVerifyCfToken(accountId, apiToken);
      if (!result.ok) throw new Error(result.message);
      await desktopSaveCfCredentials(accountId, apiToken);
      setCfMessage("Cloudflare token verified and saved locally.");
      await refreshCredentials();
      await refreshConnectionStatus();
      setCfEditing(false);
    } catch (err) {
      setCfError(explainDesktopError(err, "Cloudflare verification failed"));
    } finally {
      setCfBusy(false);
    }
  }

  async function handleSaveWorker() {
    setWorkerBusy(true);
    setWorkerError(null);
    setWorkerMessage(null);
    try {
      const result = await desktopVerifyWorkerConnection(workerUrl, adminToken);
      await desktopSaveWorkerConnection({
        workerUrl: result.workerUrl,
        adminToken,
        workerScriptName: result.workerScriptName,
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

  async function handleRefreshStatus() {
    const url = credentials?.workerUrl?.trim() || workerUrl.trim();
    const token = credentials?.adminToken?.trim() || adminToken.trim();
    if (!url || !token) {
      setWorkerError({
        title: "Worker not connected",
        detail: "Save a Worker URL and admin token first.",
        fix: "Paste your workers.dev URL and ADMIN_TOKEN, then verify.",
      });
      return;
    }
    setWorkerError(null);
    await refreshConnectionStatus();
  }

  async function handleRequestRecoveryToken() {
    setRecoveryBusy(true);
    setRecoveryError(null);
    setRecoveryMessage(null);
    setRecoveryToken("");
    try {
      const result = await desktopRequestAdminRecoveryToken();
      if (!result.ok) {
        throw new Error(result.error ?? "Could not issue recovery token");
      }
      if (result.devToken) {
        setRecoveryToken(result.devToken);
        setRecoveryMessage(
          "Recovery token issued (dev mode). Paste it below with a new admin token.",
        );
      } else {
        setRecoveryMessage(
          "A recovery token was emailed to your account address.",
        );
      }
    } catch (err) {
      setRecoveryError(
        explainDesktopError(err, "Could not issue recovery token"),
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handleRecoverAdmin() {
    setRecoveryBusy(true);
    setRecoveryError(null);
    setRecoveryMessage(null);
    const url = (credentials?.workerUrl ?? "").trim();
    const email = (credentials?.relaybaseEmail ?? "").trim();
    const token = recoveryToken.trim();
    const next = newAdminToken.trim();
    if (!url || !email || !token || !next) {
      setRecoveryError({
        title: "All fields are required",
        detail:
          "Worker URL, account email, recovery token, and a new admin token are all required.",
        fix: "Request a recovery token, then paste it and a new admin token here.",
      });
      setRecoveryBusy(false);
      return;
    }
    if (next.length < 16) {
      setRecoveryError({
        title: "New admin token too short",
        detail: "The new admin token must be at least 16 characters.",
        fix: "Use a longer token (e.g. openssl rand -hex 24).",
      });
      setRecoveryBusy(false);
      return;
    }
    try {
      const result = await desktopRecoverAdminToken({
        workerUrl: url,
        accountEmail: email,
        recoveryToken: token,
        newAdminToken: next,
      });
      if (!result.ok) throw new Error(result.error ?? "Recovery failed");
      await desktopSaveWorkerConnection({
        workerUrl: url,
        adminToken: next,
        workerScriptName: credentials?.workerScriptName,
      });
      await refreshCredentials();
      setRecoveryToken("");
      setNewAdminToken("");
      setRecoveryMessage("Admin token reset. You can now use the new token.");
    } catch (err) {
      setRecoveryError(explainDesktopError(err, "Admin token recovery failed"));
    } finally {
      setRecoveryBusy(false);
    }
  }

  const hasWorker = Boolean(credentials?.workerUrl?.trim());
  const logsOk = workerStatus?.d1Logs.configured === true;
  const searchOk = workerStatus?.d1InboxIndex.configured === true;

  const workerHealth: HealthBlock = !hasWorker
    ? {
        tone: "bad",
        label: "Not connected",
        detail:
          "No Worker URL saved. Deploy the install ZIP, then verify URL + admin token.",
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
              "Worker is reachable and admin token is accepted. No connection problems detected.",
          }
        : {
            tone: "bad",
            label: "Unreachable or unhealthy",
            detail:
              "Could not verify the Worker. Check the URL, admin token, and that the deploy is live.",
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
          detail: "Probing ops log and inbox search bindings.",
        }
      : logsOk && searchOk
        ? {
            tone: "ok",
            label: "Configured — healthy",
            detail: "Ops log and inbox search tables are reachable.",
          }
        : logsOk
          ? {
              tone: "ok",
              label: "Logs configured",
              detail:
                "RELAYBASE_LOGS works. Bind RELAYBASE_INBOX_INDEX for server search.",
            }
          : searchOk
            ? {
                tone: "ok",
                label: "Search configured",
                detail:
                  "RELAYBASE_INBOX_INDEX works. Bind RELAYBASE_LOGS for the Log page.",
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
      accountId,
      setAccountId,
      apiToken,
      setApiToken,
      workerUrl,
      setWorkerUrl,
      adminToken,
      setAdminToken,
      cfEditing,
      setCfEditing,
      workerEditing,
      setWorkerEditing,
      cfBusy,
      workerBusy,
      cfError,
      workerError,
      cfMessage,
      workerMessage,
      recoveryToken,
      setRecoveryToken,
      newAdminToken,
      setNewAdminToken,
      recoveryBusy,
      recoveryError,
      recoveryMessage,
      resetCfDraft,
      resetWorkerDraft,
      handleSaveCf,
      handleSaveWorker,
      handleRefreshStatus,
      handleRequestRecoveryToken,
      handleRecoverAdmin,
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
      accountId,
      apiToken,
      workerUrl,
      adminToken,
      cfEditing,
      workerEditing,
      cfBusy,
      workerBusy,
      cfError,
      workerError,
      cfMessage,
      workerMessage,
      recoveryToken,
      newAdminToken,
      recoveryBusy,
      recoveryError,
      recoveryMessage,
    ],
  );

  return (
    <SettingsConnectionContext.Provider value={value}>
      {children}
    </SettingsConnectionContext.Provider>
  );
}
