"use client";

import {
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Pencil,
  RefreshCw,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AdminTokenPanel } from "@/dashboard/components/AdminTokenPanel";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  WORKER_INSTALL_ZIP_URL,
  desktopOpenExternal,
  desktopRecoverAdminToken,
  desktopRequestAdminRecoveryToken,
  desktopSaveCfCredentials,
  desktopSaveWorkerConnection,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import {
  cfConnectedFromCredentials,
  type HealthTone,
} from "@/lib/dashboard/connection-status";
import { useConnectionStatus } from "@/lib/dashboard/use-connection-status";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 12) return "••••••••••••";
  return `${trimmed.slice(0, 6)}${"•".repeat(14)}${trimmed.slice(-4)}`;
}

function HealthStatus({
  tone,
  label,
  detail,
}: {
  tone: HealthTone;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {tone === "pending" ? (
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <span
          className={cn(
            "mt-1 size-2.5 shrink-0 rounded-full",
            tone === "ok" && "bg-emerald-500",
            tone === "bad" && "bg-red-500",
            tone === "neutral" && "bg-muted-foreground/40",
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            tone === "ok" && "text-emerald-700 dark:text-emerald-400",
            tone === "bad" && "text-red-700 dark:text-red-400",
            (tone === "pending" || tone === "neutral") && "text-foreground",
          )}
        >
          {label}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function ConnectionCard({
  icon: Icon,
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <CardTitle className="text-sm">{title}</CardTitle>
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onEdit}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all font-mono text-xs text-foreground">
        {value}
      </p>
    </div>
  );
}

function DesktopSettingsBody() {
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

  // ADMIN_TOKEN recovery state.
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newAdminToken, setNewAdminToken] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] =
    useState<DesktopErrorHelp | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  async function handleRequestRecoveryToken() {
    setRecoveryBusy(true);
    setRecoveryError(null);
    setRecoveryMessage(null);
    setRecoveryToken("");
    try {
      const result = await desktopRequestAdminRecoveryToken();
      if (!result.ok) throw new Error(result.error ?? "Could not issue recovery token");
      if (result.devToken) {
        setRecoveryToken(result.devToken);
        setRecoveryMessage(
          "Recovery token issued (dev mode). Paste it below with a new admin token.",
        );
      } else {
        setRecoveryMessage("A recovery token was emailed to your account address.");
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
        detail: "Worker URL, account email, recovery token, and a new admin token are all required.",
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

  // First visit with no CF creds → open edit so setup is obvious.
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

  const hasWorker = Boolean(credentials?.workerUrl?.trim());
  const workerHealth: { tone: HealthTone; label: string; detail: string } =
    !hasWorker
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

  const r2Health: { tone: HealthTone; label: string; detail: string } =
    !hasWorker
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={statusBusy || workerBusy}
            aria-label="Refresh status"
            onClick={() => void handleRefreshStatus()}
          >
            {statusBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        }
      >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Cloudflare assist, routing Worker, and inbound R2 status.
          </p>
        </div>
      </DesktopTitleBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
      <ConnectionCard
        icon={Cloud}
        title="Cloudflare connection"
        description={
          <>
            Optional API token for zone import and Email Routing assist. Stored
            only in <span className="font-mono">~/.relaybase</span> — not
            required to deploy the Worker.
          </>
        }
        editing={cfEditing}
        onEdit={() => {
          resetCfDraft();
          setCfEditing(true);
        }}
      >
        <HealthStatus
          tone={cfConnected ? "ok" : "bad"}
          label={cfConnected ? "Connected" : "Not connected"}
          detail={
            cfConnected
              ? "API token saved locally and ready for zone assist."
              : "Add an Account ID and API token to import zones from Cloudflare."
          }
        />
        {cfEditing ? (
          <>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Shield className="size-3.5" />
                Required token permissions
              </div>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 text-brand hover:underline"
                onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
              >
                Create token in Cloudflare
                <ExternalLink className="size-3" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="settings-cf-account">Account ID</Label>
                <Input
                  id="settings-cf-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="32-char hex from Cloudflare dashboard"
                  className="font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-cf-token">API token</Label>
                <Input
                  id="settings-cf-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Paste token — stored locally"
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <DesktopErrorBanner error={cfError} />
            {cfMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {cfMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!accountId.trim() || !apiToken.trim() || cfBusy}
                onClick={() => void handleSaveCf()}
              >
                {cfBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Verify &amp; save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cfBusy}
                onClick={() => {
                  resetCfDraft();
                  setCfEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow
              label="Account ID"
              value={credentials?.accountId?.trim() || "—"}
            />
            <SummaryRow
              label="API token"
              value={maskSecret(credentials?.apiToken ?? "")}
            />
          </div>
        )}
      </ConnectionCard>

      <ConnectionCard
        icon={Server}
        title="Routing Worker"
        description="Deploy with Wrangler from the install ZIP, then paste the workers.dev URL and the same admin token you set as a secret."
        editing={workerEditing}
        onEdit={() => {
          resetWorkerDraft();
          setWorkerEditing(true);
        }}
      >
        <HealthStatus {...workerHealth} />
        {workerEditing ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">Install package</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Updates are deployed with Wrangler — the app does not upload
                  Worker code.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
              >
                <Download className="size-3.5" />
                Install ZIP
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-worker-url">Worker URL</Label>
              <Input
                id="settings-worker-url"
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://relaybase-api.<subdomain>.workers.dev"
                className="font-mono text-xs"
                autoComplete="off"
              />
            </div>

            <AdminTokenPanel value={adminToken} onChange={setAdminToken} />

            <DesktopErrorBanner error={workerError} />
            {workerMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {workerMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  !workerUrl.trim() || !adminToken.trim() || workerBusy
                }
                onClick={() => void handleSaveWorker()}
              >
                {workerBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Verify &amp; save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={workerBusy}
                onClick={() => {
                  resetWorkerDraft();
                  setWorkerEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryRow
                label="Worker URL"
                value={
                  workerStatus?.workerUrl ||
                  credentials?.workerUrl?.trim() ||
                  "—"
                }
              />
              <SummaryRow
                label="Script"
                value={
                  workerStatus?.workerScriptName ||
                  credentials?.workerScriptName ||
                  "relaybase-api"
                }
              />
              <SummaryRow
                label="Admin token"
                value={maskSecret(credentials?.adminToken ?? "")}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
            >
              <Download className="size-3.5" />
              Install ZIP
            </Button>
            <DesktopErrorBanner error={workerError} />
          </div>
        )}
      </ConnectionCard>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <CardTitle className="text-sm">Reset admin token</CardTitle>
          </div>
          <CardDescription>
            Lost your ADMIN_TOKEN? Request a one-time recovery token from the
            Relaybase console (emailed to your account address), then set a new
            admin token here — no Wrangler needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recovery-token">Recovery token</Label>
            <Input
              id="recovery-token"
              value={recoveryToken}
              onChange={(e) => setRecoveryToken(e.target.value)}
              placeholder="token from your email"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-admin-token">New admin token</Label>
            <Input
              id="new-admin-token"
              type="password"
              value={newAdminToken}
              onChange={(e) => setNewAdminToken(e.target.value)}
              placeholder="rb_admin_… (min 16 chars)"
              className="font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <DesktopErrorBanner error={recoveryError} />
          {recoveryMessage ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {recoveryMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={recoveryBusy || !credentials?.relaybaseSession}
              onClick={() => void handleRequestRecoveryToken()}
            >
              {recoveryBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Request recovery token
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                recoveryBusy ||
                !recoveryToken.trim() ||
                !newAdminToken.trim() ||
                !credentials?.workerUrl
              }
              onClick={() => void handleRecoverAdmin()}
            >
              Reset admin token
            </Button>
          </div>
          {!credentials?.relaybaseSession ? (
            <p className="text-[11px] text-muted-foreground">
              Sign in to your Relaybase account to use admin token recovery.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HardDrive
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <CardTitle className="text-sm">Inbound R2</CardTitle>
          </div>
          <CardDescription>
            Binding check from{" "}
            <span className="font-mono">GET /console/connect</span>. Create the
            bucket in your account before deploy (
            <span className="font-mono">relaybase-inbound</span>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <HealthStatus {...r2Health} />
          {hasWorker ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Bucket</p>
                <p className="mt-0.5 font-mono">
                  {workerStatus?.inboundBucketName || "relaybase-inbound"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Binding</p>
                <p className="mt-0.5 font-mono">INBOUND</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="mt-0.5 font-mono">
                  {statusBusy && workerStatus?.r2TotalBytes == null
                    ? "…"
                    : workerStatus?.r2TotalBytes != null
                      ? `${formatBytes(workerStatus.r2TotalBytes)}${
                          workerStatus.r2UsageTruncated ? "+" : ""
                        }`
                      : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Objects</p>
                <p className="mt-0.5 font-mono">
                  {statusBusy && workerStatus?.r2ObjectCount == null
                    ? "…"
                    : workerStatus?.r2ObjectCount != null
                      ? `${workerStatus.r2ObjectCount.toLocaleString()}${
                          workerStatus.r2UsageTruncated ? "+" : ""
                        }`
                      : "—"}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { isDesktop: desktop } = useDesktopChrome();
  const desktopCtx = useOptionalDesktop();

  if (!desktop || !desktopCtx) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DesktopTitleBar className="px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Cloudflare, Worker, and R2 connection management.
            </p>
          </div>
        </DesktopTitleBar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
            <Alert>
              <AlertTitle>Desktop app required</AlertTitle>
              <AlertDescription>
                Connection settings are managed in the Relaybase desktop app
                (stored under ~/.relaybase). Open Settings there to verify
                Cloudflare, your routing Worker, and inbound R2.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return <DesktopSettingsBody />;
}
