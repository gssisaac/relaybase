"use client";

import { ArrowLeft, Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  biometryLabel,
  desktopAuthenticateBiometry,
  desktopCheckBiometry,
  isUserDismissedBiometry,
  type BiometryStatus,
} from "@/lib/desktop/biometry";
import {
  desktopOwnerLogin,
  desktopOwnerSessionStatus,
  desktopOwnerUnlock,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  isDesktopRuntime,
  type OwnerSessionStatus,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { ownerConnectProbe, ownerLogin } from "@/lib/desktop/owner-session";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

function visibleUnlockError(err: unknown): string | null {
  if (isUserDismissedBiometry(err)) return null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (!message.trim() || isUserDismissedBiometry(message)) return null;
  return message;
}

/**
 * Daily unlock machine:
 *   hydrate → hasAccess | (hasRefresh ? Touch ID → owner_unlock : idle)
 * Passtoken is a user choice, or the follow-up after a refresh is gone.
 * Touch ID is never the path when there is no keyring session.
 */
function applyWorkerUrl(url: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  w.__RELAYBASE_WORKER_URL__ = url.replace(/\/$/, "");
}

export function OwnerUnlockPanel({
  workerUrl: workerUrlProp,
  onUnlocked,
}: {
  workerUrl?: string;
  onUnlocked: () => void;
}) {
  const router = useRouter();
  const { credentials, setCredentials, refresh } = useDesktop();
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();
  const savedWorkerUrl = (
    workerUrlProp ||
    credentials?.workerUrl ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const [status, setStatus] = useState<OwnerSessionStatus | null>(null);
  const [bio, setBio] = useState<BiometryStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [passtoken, setPasstoken] = useState("");
  const [workerUrlDraft, setWorkerUrlDraft] = useState(savedWorkerUrl);
  const [showLogin, setShowLogin] = useState(false);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  useEffect(() => {
    if (savedWorkerUrl) setWorkerUrlDraft(savedWorkerUrl);
  }, [savedWorkerUrl]);

  const label = biometryLabel(
    bio?.biometryType ?? 0,
    status?.platform ?? "macos",
  );
  const hasRefresh = Boolean(status?.hasRefresh);
  // Plugin `status` is not the gate — authenticate goes through
  // owner_touch_id_cmd (AppKit main thread). Unsigned tauri dev often
  // reports the plugin unavailable even when Touch ID works.
  const canRetryTouchId = hasRefresh && (status?.biometryEnabled ?? true);

  const hydrate = useCallback(async () => {
    const [session, nextBio] = await Promise.all([
      desktopOwnerSessionStatus(),
      desktopCheckBiometry(),
    ]);
    setStatus(session);
    setBio(nextBio);
    setUsername((prev) => prev || session.username);
    return { session, nextBio };
  }, []);

  const unlockWithRefresh = useCallback(
    async (promptBiometry: boolean) => {
      const { session } = await hydrate();
      if (session.hasAccess) {
        onUnlockedRef.current();
        return;
      }
      if (!session.hasRefresh) {
        return;
      }
      if (promptBiometry && session.biometryEnabled) {
        await desktopAuthenticateBiometry(
          "Unlock your Relaybase owner session",
        );
      }
      await desktopOwnerUnlock();
      onUnlockedRef.current();
    },
    [hydrate],
  );

  const runUnlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await unlockWithRefresh(true);
    } catch (err) {
      const shown = visibleUnlockError(err);
      if (shown) setError(shown);
      try {
        const after = await desktopOwnerSessionStatus();
        setStatus(after);
        if (shown && !after.hasRefresh) {
          setShowLogin(true);
        }
      } catch {
        /* keep the unlock error on idle */
      }
    } finally {
      setBusy(false);
    }
  }, [unlockWithRefresh]);

  const didBootstrap = useRef(false);
  useEffect(() => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;
    void runUnlock();
  }, [runUnlock]);

  async function retryTouchId() {
    if (!hasRefresh) return;
    await runUnlock();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const url = (savedWorkerUrl || workerUrlDraft).trim().replace(/\/$/, "");
    if (!url) {
      setError("Enter the Worker URL.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isDesktopRuntime()) {
        await desktopOwnerLogin({
          workerUrl: url,
          username,
          passtoken,
          biometryEnabled: status?.biometryEnabled ?? true,
        });
        await desktopSaveWorkerConnection({
          workerUrl: url,
          adminToken: "",
          workerScriptName: "relaybase-api",
        });
        await refresh();
      } else {
        applyWorkerUrl(url);
        await ownerLogin({ username, passtoken, label: "browser" });
        const result = await ownerConnectProbe();
        setCredentials({
          accountId: result.accountId || credentials?.accountId || "",
          installToken: credentials?.installToken ?? "",
          workerUrl: url,
          adminToken: "",
          workerScriptName:
            result.workerScriptName || credentials?.workerScriptName || "",
          workerVersion: credentials?.workerVersion ?? "",
          relaybaseAccountId: credentials?.relaybaseAccountId ?? "",
          relaybaseEmail: credentials?.relaybaseEmail ?? "",
          relaybaseSession: credentials?.relaybaseSession ?? "",
          cfOauthAccessToken: credentials?.cfOauthAccessToken ?? "",
          cfOauthRefreshToken: credentials?.cfOauthRefreshToken ?? "",
          cfOauthAccessExpiresAt: credentials?.cfOauthAccessExpiresAt ?? "",
          cfOauthAccountId: credentials?.cfOauthAccountId ?? "",
        });
      }
      void desktopRegisterWorkerWithConsole(url).catch(() => {
        /* best-effort */
      });
      setPasstoken("");
      onUnlocked();
    } catch (err) {
      const shown = visibleUnlockError(err);
      setError(shown ?? "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (showLogin) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <MacDesktopTitlebarSpacer />
        <div
          {...dragRegionProps}
          className={cn(
            "flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-16",
            dragRegionClassName,
          )}
        >
          <div
            className={cn("w-full max-w-sm space-y-3", noDragClassName)}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              onClick={() => {
                setError(null);
                setPasstoken("");
                setShowLogin(false);
              }}
            >
              <ArrowLeft className="size-3" />
              Back
            </button>
            <form
              className="space-y-4 rounded-xl border border-border bg-card p-6"
              onSubmit={(e) => void handleLogin(e)}
              data-allow-tab-focus
            >
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">
                  Sign in with passtoken
                </h1>
                <p className="text-xs text-muted-foreground">
                  Enter the owner username and the passtoken you downloaded. The
                  app does not store the passtoken.
                </p>
              </div>
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              {savedWorkerUrl ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="owner-worker-url">Worker URL</Label>
                  <Input
                    id="owner-worker-url"
                    value={workerUrlDraft}
                    onChange={(e) => setWorkerUrlDraft(e.target.value)}
                    placeholder="https://relaybase-api.<subdomain>.workers.dev"
                    className="font-mono text-xs"
                    autoComplete="off"
                    required
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="owner-username">Username</Label>
                <Input
                  id="owner-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-passtoken">Passtoken</Label>
                <Input
                  id="owner-passtoken"
                  type="password"
                  value={passtoken}
                  onChange={(e) => setPasstoken(e.target.value)}
                  autoComplete="off"
                  required
                  className="font-mono text-xs"
                />
                <button
                  type="button"
                  className="text-left text-xs text-muted-foreground hover:underline"
                  onClick={() => router.push("/setup/recover-admin")}
                >
                  I forgot my passtoken
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <MacDesktopTitlebarSpacer />
      <div
        {...dragRegionProps}
        className={cn("flex min-h-0 flex-1 flex-col", dragRegionClassName)}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-6 max-w-sm space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">
              Unlock Relaybase
            </h1>
            <p className="text-xs text-muted-foreground">
              {hasRefresh
                ? `Use ${label} to unlock your owner session. The passtoken is not stored on this Mac.`
                : "Sign in with your username and passtoken to restore this Mac's owner session."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !canRetryTouchId}
            onClick={() => void retryTouchId()}
            aria-label={`Unlock with ${label}`}
            className={cn(
              "h-auto flex-col gap-3 px-6 py-4",
              noDragClassName,
            )}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            <Fingerprint
              className={cn("size-12 text-foreground", busy && "animate-pulse")}
            />
            <span className="text-base font-medium tracking-tight">{label}</span>
          </Button>
        </div>
        <div
          className={cn(
            "mx-auto flex w-full max-w-sm flex-col gap-2 px-6 pb-10",
            noDragClassName,
          )}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {error ? (
            <p className="text-center text-xs text-destructive">{error}</p>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setError(null);
              setShowLogin(true);
            }}
          >
            Sign in with passtoken
          </Button>
          <button
            type="button"
            className="pt-2 text-center text-[11px] text-muted-foreground hover:underline"
            disabled={busy}
            onClick={() => router.push("/setup")}
          >
            Install on another Cloudflare account
          </button>
        </div>
      </div>
    </div>
  );
}
