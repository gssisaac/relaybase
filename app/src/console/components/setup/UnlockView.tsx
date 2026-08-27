"use client";

import { ArrowLeft, Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
 * Common unlock surface for owner and invited. Touch ID when a keyring secret
 * exists; passtoken / mobile-password form when it does not.
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

  const [workerUrlDraft, setWorkerUrlDraft] = useState(savedWorkerUrl ?? "");
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

  const label = store.biometryLabel;
  const busy = store.busy;
  const hasKeyringSecret =
    role === "invited"
      ? Boolean(store.teamStatus?.hasSecret)
      : Boolean(store.ownerStatus?.hasRefresh);

  useEffect(() => {
    if (hasKeyringSecret) return;
    if (mode === "secret") return;
    store.showSecretForm();
  }, [hasKeyringSecret, mode, store]);

  async function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    const url = normalizeWorkerUrl(savedWorkerUrl || workerUrlDraft);
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

  const shell = (
    children: React.ReactNode,
    opts?: { pb?: string },
  ) => (
    <div className="flex h-svh flex-col bg-background">
      <MacDesktopTitlebarSpacer />
      <div
        {...dragRegionProps}
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center px-6",
          opts?.pb ?? "pb-10",
          dragRegionClassName,
        )}
      >
        <div
          className={cn("flex w-full max-w-sm flex-col gap-6", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (mode === "secret") {
    return shell(
      <>
        {hasKeyringSecret ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:underline"
            onClick={() => {
              store.clearError();
              setSecret("");
              store.requestPrompt();
            }}
          >
            <ArrowLeft className="size-3" />
            Back to {label}
          </button>
        ) : null}

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
          {savedWorkerUrl ? null : (
            <WorkerUrlPicker
              value={workerUrlDraft}
              onChange={setWorkerUrlDraft}
              seedUrls={workerUrlSeeds}
              disabled={busy}
            />
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
              <p className="text-[11px] text-muted-foreground">
                Paste only the token starting with{" "}
                <span className="font-mono">rb_pass_</span>, not a{" "}
                <span className="font-mono">PASSTOKEN=</span> line from the
                download file.
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
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
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
      </>,
    );
  }

  return shell(
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Unlock Relaybase
        </h1>
        <p className="text-xs text-muted-foreground">
          Use {label} to unlock your {role === "invited" ? "team" : "owner"}{" "}
          session.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => void store.promptUnlock()}
        aria-label={`Unlock with ${label}`}
        className="h-auto flex-col gap-3 self-center px-6 py-4"
      >
        <Fingerprint
          className={cn("size-12 text-foreground", busy && "animate-pulse")}
        />
        <span className="text-base font-medium tracking-tight">{label}</span>
      </Button>
      <div className="flex w-full flex-col gap-2">
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
          {role === "invited"
            ? "Use a different account"
            : "Sign in with another Cloudflare account"}
        </button>
      </div>
    </>,
  );
}
