"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import { WorkerUrlPicker } from "@/console/components/setup/WorkerUrlPicker";
import { resolveWorkerUrl } from "@/lib/desktop/app-session/resolve-worker-url";
import { useAppSession } from "@/lib/desktop/app-session";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { normalizePasstokenInput } from "@/lib/desktop/worker-url/normalize-passtoken";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";
import { useDesktop, useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

/**
 * Passtoken / mobile-password form for first login or mail session recovery.
 */
export function UnlockView({
  role,
}: {
  role: "owner" | "invited";
  mode?: "secret";
}) {
  const router = useRouter();
  const store = useAppSession();
  const { credentials, teamLogin } = useDesktop();
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  const savedWorkerUrl = resolveWorkerUrl({
    role,
    ownerStatus: store.ownerStatus,
    teamStatus: store.teamStatus,
    credentials,
    teamLogin,
  });
  const savedUsername =
    role === "invited"
      ? teamLogin?.accountEmail ?? ""
      : store.ownerStatus?.username ?? "";

  const [workerUrl, setWorkerUrl] = useState(savedWorkerUrl ?? "");
  const [username, setUsername] = useState(savedUsername);
  const [secret, setSecret] = useState("");

  const workerUrlSeeds = useMemo(
    () =>
      role === "invited"
        ? [teamLogin?.workerUrl, store.teamStatus?.workerUrl]
        : [credentials?.workerUrl, store.ownerStatus?.workerUrl],
    [
      role,
      credentials?.workerUrl,
      store.ownerStatus?.workerUrl,
      teamLogin?.workerUrl,
      store.teamStatus?.workerUrl,
    ],
  );

  const busy = store.busy;
  const selectedUrl = normalizeWorkerUrl(workerUrl);
  const canSubmit = Boolean(selectedUrl) && Boolean(username.trim()) && Boolean(secret);

  async function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    const url = selectedUrl;
    const passtoken = normalizePasstokenInput(secret);
    if (!url || !passtoken) return;
    try {
      if (role === "invited") {
        await store.loginInvited({
          workerUrl: url,
          accountEmail: username.trim(),
          mobilePassword: secret,
        });
      } else {
        await store.loginWithPasstoken({
          workerUrl: url,
          username: username.trim(),
          passtoken,
        });
      }
      rememberWorkerUrl(url);
      setSecret("");
    } catch {
      /* error surfaced via store.error */
    }
  }

  return (
    <div className="flex h-svh flex-col bg-background">
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
              Unlock Relaybase
            </h1>
            <p className="text-xs text-muted-foreground">
              {role === "invited"
                ? "Sign in with your account email and the mobile password your admin set up."
                : "Sign in with your username and the passtoken you downloaded. The app does not store the passtoken."}
            </p>
          </div>

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={submitSecret}
            data-allow-tab-focus
          >
            {store.error ? (
              <p className="text-center text-xs text-destructive">{store.error}</p>
            ) : null}
            <WorkerUrlPicker
              value={workerUrl}
              onChange={setWorkerUrl}
              seedUrls={workerUrlSeeds}
              disabled={busy}
            />
            <div className="space-y-1.5">
              <Label htmlFor="unlock-username">
                {role === "invited" ? "Account email" : "Username"}
              </Label>
              <Input
                id="unlock-username"
                type={role === "invited" ? "email" : "text"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete={role === "invited" ? "email" : "username"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unlock-secret">
                {role === "invited" ? "Mobile password" : "Passtoken"}
              </Label>
              <Input
                id="unlock-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
                required
                className="font-mono text-xs"
              />
              {role === "owner" ? (
                <p className="text-[11px] text-muted-foreground">
                  Paste only the token starting with{" "}
                  <span className="font-mono">rb_pass_</span>.
                </p>
              ) : null}
              {role === "owner" ? (
                <button
                  type="button"
                  className="text-left text-xs text-muted-foreground hover:underline"
                  onClick={() => store.enterRecover()}
                >
                  I forgot my passtoken
                </button>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={busy || !canSubmit}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <button
            type="button"
            className="text-center text-[11px] text-muted-foreground hover:underline"
            disabled={busy}
            onClick={() => router.push("/setup")}
          >
            {role === "invited"
              ? "Use a different account"
              : "Sign in with another Cloudflare account"}
          </button>
          {role === "invited" ? (
            <button
              type="button"
              className="text-center text-[11px] text-muted-foreground hover:underline"
              disabled={busy}
              onClick={() => {
                store.clearError();
                void store.switchToOwnerLogin();
              }}
            >
              Log in as owner
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
