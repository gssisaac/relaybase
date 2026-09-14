"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerUrlPicker } from "@/console/components/setup/WorkerUrlPicker";
import { cn } from "@/lib/utils";
import { hasOwnerSession } from "@/lib/desktop/auth";
import { webOwnerLogin } from "@/lib/desktop/bridge/web-owner-bridge";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";
import { useMailRuntime } from "@/mail-platform/runtime";
import { useAppSession } from "@/lib/desktop/app-session";
import { recoverAdminHref } from "@/lib/navigation/recover-admin";

type Role = "owner" | "team";

function workerUrlFromQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return new URLSearchParams(window.location.search).get("workerUrl") ?? "";
  } catch {
    return "";
  }
}

function setWorkerUrlGlobal(workerUrl: string): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  if (workerUrl) {
    w.__RELAYBASE_WORKER_URL__ = workerUrl;
  } else {
    delete w.__RELAYBASE_WORKER_URL__;
  }
}

/**
 * Unified web account login (owner passtoken or teammate password). The web
 * entry is `/login` (Owner tab default); also used on `/setup/connect`.
 * First-time install lives at `/setup`.
 */
export function AccountLoginView({
  defaultRole = "owner",
}: {
  defaultRole?: Role;
}) {
  const router = useRouter();
  const store = useAppSession();
  const { session } = useMailRuntime();
  const [role, setRole] = useState<Role>(defaultRole);
  const [workerUrl, setWorkerUrl] = useState(workerUrlFromQuery);
  const [workerUrlSeeds] = useState(() => [workerUrlFromQuery()]);
  const [accountEmail, setAccountEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUrl = normalizeWorkerUrl(workerUrl);
  const canSubmit =
    Boolean(trimmedUrl) &&
    Boolean(secret) &&
    (role === "team" ? Boolean(accountEmail.trim()) : true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (role === "owner") {
        try {
          await webOwnerLogin({ workerUrl: trimmedUrl, passtoken: secret });
        } catch (err) {
          if (!hasOwnerSession()) setWorkerUrlGlobal("");
          throw err;
        }
        rememberWorkerUrl(trimmedUrl);
        router.push("/dashboard");
      } else {
        await session.login({
          workerUrl: trimmedUrl,
          accountEmail: accountEmail.trim(),
          mobilePassword: secret,
        });
        rememberWorkerUrl(trimmedUrl);
        router.push("/inbox");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Relaybase</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["owner", "team"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setError(null);
              }}
              className={cn(
                "rounded-md py-1.5 font-medium transition-colors",
                role === r
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "owner" ? "Owner" : "Teammate"}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <WorkerUrlPicker
            value={workerUrl}
            onChange={setWorkerUrl}
            seedUrls={workerUrlSeeds}
            disabled={busy}
          />
          {role === "team" ? (
            <div className="space-y-1.5">
              <Label htmlFor="account-email">Account email</Label>
              <Input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                disabled={busy}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="secret">
              {role === "owner" ? "Passtoken" : "Password"}
            </Label>
            <Input
              id="secret"
              type="password"
              autoComplete={role === "owner" ? "off" : "current-password"}
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className={cn(role === "owner" && "font-mono text-xs")}
              disabled={busy}
            />
            {role === "owner" ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Paste the token starting with{" "}
                  <span className="font-mono">rb_pass_</span>.
                </p>
                <button
                  type="button"
                  className="text-left text-xs text-muted-foreground hover:underline"
                  disabled={busy}
                  onClick={() => {
                    store.clearError();
                    store.enterRecover();
                    router.push(recoverAdminHref(trimmedUrl));
                  }}
                >
                  I forgot my passtoken
                </button>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Ask your team admin for the Worker URL and your account
                password (Accounts → Teammate login).
              </p>
            )}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Setting up Relaybase for the first time?{" "}
          <Link href="/setup" className="hover:underline">
            Install on your Cloudflare account
          </Link>
        </p>
      </div>
    </div>
  );
}
