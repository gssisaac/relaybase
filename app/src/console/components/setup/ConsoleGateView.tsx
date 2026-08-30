"use client";

import { Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import { WorkerUrlPicker } from "@/console/components/setup/WorkerUrlPicker";
import {
  isMissingWorkerUnlockMessage,
  missingWorkerHelp,
} from "@/lib/desktop/app-session/errors";
import { resolveWorkerUrl } from "@/lib/desktop/app-session/resolve-worker-url";
import { useAppSession } from "@/lib/desktop/app-session";
import { biometryLabel } from "@/lib/desktop/biometry/label";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { normalizePasstokenInput } from "@/lib/desktop/worker-url/normalize-passtoken";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";
import { DesktopErrorBanner, useDesktop, useDesktopChrome } from "@/lib/desktop/shell";
import { readLastPath, writeSidebarMode } from "@/lib/navigation/sidebar-mode";
import { cn } from "@/lib/utils";

const LOCAL_OPERATOR_USER_ID = "desktop";

/**
 * Owner console gate — typed passtoken fallback, plus Touch ID retry
 * to read the stored keyring passtoken.
 */
export function ConsoleGateView() {
  const router = useRouter();
  const store = useAppSession();
  const { credentials } = useDesktop();
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  const savedWorkerUrl = resolveWorkerUrl({
    role: "owner",
    ownerStatus: store.ownerStatus,
    teamStatus: store.teamStatus,
    credentials,
    teamLogin: null,
  });
  const [workerUrl, setWorkerUrl] = useState(savedWorkerUrl ?? "");
  const [secret, setSecret] = useState("");

  const label = biometryLabel(0, store.ownerStatus?.platform ?? "macos");
  const busy = store.busy;
  const canTryBio = Boolean(store.ownerStatus?.hasPasstoken);

  const workerUrlSeeds = useMemo(
    () => [credentials?.workerUrl, store.ownerStatus?.workerUrl],
    [credentials?.workerUrl, store.ownerStatus?.workerUrl],
  );

  const selectedUrl = normalizeWorkerUrl(workerUrl);
  const canSubmit = Boolean(selectedUrl) && Boolean(secret);
  const missingWorkerError = isMissingWorkerUnlockMessage(store.error, "owner");

  async function submitPasstoken(e: React.FormEvent) {
    e.preventDefault();
    const url = selectedUrl;
    const passtoken = normalizePasstokenInput(secret);
    if (!url || !passtoken) return;
    try {
      await store.loginConsoleWithPasstoken({
        workerUrl: url,
        passtoken,
      });
      rememberWorkerUrl(url);
      setSecret("");
    } catch {
      /* store.error */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <MacDesktopTitlebarSpacer />
      <div
        {...dragRegionProps}
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10",
          dragRegionClassName,
        )}
      >
        <div
          className={cn("flex w-full max-w-sm flex-col gap-6", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold tracking-tight">
              Unlock console
            </h1>
            <p className="text-xs text-muted-foreground">
              Use {label} to read your stored passtoken, or type it if
              biometry fails or is declined.
            </p>
          </div>

          {canTryBio ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void store.ensureConsoleAccess()}
              aria-label={`Unlock console with ${label}`}
              className="h-auto flex-col gap-3 self-center px-6 py-4"
            >
              <Fingerprint
                className={cn(
                  "size-12 text-foreground",
                  busy && "animate-pulse",
                )}
              />
              <span className="text-base font-medium tracking-tight">
                {label}
              </span>
            </Button>
          ) : null}

          {missingWorkerError ? (
            <DesktopErrorBanner error={missingWorkerHelp("owner")} />
          ) : store.error ? (
            <p className="text-center text-xs text-destructive">{store.error}</p>
          ) : null}

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={submitPasstoken}
            data-allow-tab-focus
          >
            <WorkerUrlPicker
              value={workerUrl}
              onChange={setWorkerUrl}
              seedUrls={workerUrlSeeds}
              disabled={busy}
            />
            <div className="space-y-1.5">
              <Label htmlFor="console-gate-passtoken">Passtoken</Label>
              <Input
                id="console-gate-passtoken"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
                required
                className="font-mono text-xs"
              />
              <button
                type="button"
                className="text-left text-xs text-muted-foreground hover:underline"
                disabled={busy}
                onClick={() => {
                  store.clearError();
                  store.closeConsoleGate();
                  store.enterRecover();
                  router.push("/setup/recover-admin");
                }}
              >
                I forgot my passtoken
              </button>
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={busy || !canSubmit}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Sign in with passtoken"
              )}
            </Button>
          </form>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              store.clearError();
              store.closeConsoleGate();
              writeSidebarMode(LOCAL_OPERATOR_USER_ID, "email");
              router.replace(readLastPath(LOCAL_OPERATOR_USER_ID, "email"));
            }}
          >
            Back to mailbox
          </Button>

          <button
            type="button"
            className="text-center text-[11px] text-muted-foreground hover:underline"
            disabled={busy}
            onClick={() => {
              store.clearError();
              store.closeConsoleGate();
              router.push("/setup");
            }}
          >
            Back to setup
          </button>
        </div>
      </div>
    </div>
  );
}
