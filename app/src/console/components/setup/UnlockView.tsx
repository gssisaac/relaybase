"use client";

import { ArrowLeft, Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MacDesktopTitlebarSpacer } from "@/components/layout/MacDesktopTitlebarSpacer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSession } from "@/lib/app-session";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

/**
 * Common unlock surface for owner and invited. The store owns all state;
 * this view only renders the prompt / secret form and forwards user actions.
 * Touch ID is fired by the store on boot, so on the prompting branch this
 * view is just a fingerprint affordance + a "use secret" fallback.
 */
export function UnlockView({
  role,
  mode,
}: {
  role: "owner" | "invited";
  mode: "prompting" | "idle" | "secret";
}) {
  const router = useRouter();
  const store = useAppSession();
  const { credentials, teamLogin } = useDesktop();
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  const savedWorkerUrl = (
    role === "invited"
      ? teamLogin?.workerUrl
      : credentials?.workerUrl
  )
    ?.trim()
    .replace(/\/$/, "");
  const savedUsername = role === "invited" ? teamLogin?.accountEmail ?? "" : "";

  const [workerUrlDraft, setWorkerUrlDraft] = useState(savedWorkerUrl ?? "");
  const [username, setUsername] = useState(savedUsername);
  const [secret, setSecret] = useState("");

  const label = store.biometryLabel;
  const busy = store.busy;
  const hasKeyringSecret =
    role === "invited"
      ? Boolean(store.teamStatus?.hasSecret)
      : Boolean(store.ownerStatus?.hasRefresh);

  async function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    const url = (savedWorkerUrl || workerUrlDraft).trim().replace(/\/$/, "");
    if (!url || !secret) return;
    try {
      if (role === "invited") {
        await store.loginInvited({
          workerUrl: url,
          accountEmail: username,
          mobilePassword: secret,
        });
      } else {
        await store.loginWithPasstoken({
          workerUrl: url,
          username,
          passtoken: secret,
        });
      }
      setSecret("");
    } catch {
      /* error surfaced via store.error */
    }
  }

  if (mode === "secret") {
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
                store.clearError();
                setSecret("");
                store.requestPrompt();
              }}
            >
              <ArrowLeft className="size-3" />
              Back
            </button>
            <form
              className="space-y-4 rounded-xl border border-border bg-card p-6"
              onSubmit={submitSecret}
              data-allow-tab-focus
            >
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">
                  {role === "invited"
                    ? "Sign in with mobile password"
                    : "Sign in with passtoken"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {role === "invited"
                    ? "Enter your account email and the mobile password your admin set up."
                    : "Enter the owner username and the passtoken you downloaded. The app does not store the passtoken."}
                </p>
              </div>
              {store.error ? (
                <p className="text-xs text-destructive">{store.error}</p>
              ) : null}
              {savedWorkerUrl ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="unlock-worker-url">Worker URL</Label>
                  <Input
                    id="unlock-worker-url"
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
                  <button
                    type="button"
                    className="text-left text-xs text-muted-foreground hover:underline"
                    onClick={() => store.enterRecover()}
                  >
                    I forgot my passtoken
                  </button>
                ) : null}
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
              {hasKeyringSecret
                ? `Use ${label} to unlock your ${role === "invited" ? "team" : "owner"} session.`
                : role === "invited"
                  ? "Sign in with your account email and mobile password."
                  : "Sign in with your username and passtoken to restore this device's owner session."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !hasKeyringSecret}
            onClick={() => void store.promptUnlock()}
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
          {store.error ? (
            <p className="text-center text-xs text-destructive">{store.error}</p>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => store.showSecretForm()}
          >
            {role === "invited" ? "Sign in with password" : "Sign in with passtoken"}
          </Button>
          <button
            type="button"
            className="pt-2 text-center text-[11px] text-muted-foreground hover:underline"
            disabled={busy}
            onClick={() => router.push("/setup")}
          >
            {role === "invited" ? "Use a different account" : "Install on another Cloudflare account"}
          </button>
        </div>
      </div>
    </div>
  );
}
