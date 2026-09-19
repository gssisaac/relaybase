"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageBrandMark } from "@/console/components/setup/common/layout/AuthPageBrandMark";
import { WebAuthorizeCard } from "@/console/components/setup/web/WebAuthorizeCard";
import { registerCloudAccount } from "@/lib/auth/cloud-session";
import { fetchWebCfOAuthSessionPresent } from "@/lib/desktop/bridge/web-oauth-complete";
import {
  runWebInstallStream,
  subscribeWebInstallLog,
  type CloudInstallSignupResult,
} from "@/lib/desktop/bridge/web-install-stream";
import { useIdAvailability } from "@/features/auth/hooks/useIdAvailability";
import { getStudioApiBase } from "@/studio/lib/studio-origin";

type Step = "oauth" | "install" | "account";

export function SignupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedStep = searchParams.get("step");

  const [step, setStep] = useState<Step>("oauth");
  const [installToken, setInstallToken] = useState("");
  const [cfAccountId, setCfAccountId] = useState("");
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setPasswordConfirm] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const { available, checking } = useIdAvailability(username, step === "account");

  const runInstall = useCallback(async (accountId: string) => {
    setInstallBusy(true);
    setInstallError(null);
    setInstallLog([]);
    try {
      const result = (await runWebInstallStream({
        accountId,
        cloudSignup: true,
      })) as CloudInstallSignupResult;
      if (!result.installToken) {
        throw new Error("Install finished but cloud signup token was missing.");
      }
      setInstallToken(result.installToken);
      setCfAccountId(result.cfAccountId || accountId);
      setStep("account");
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstallBusy(false);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeWebInstallLog((ev) => {
      setInstallLog((prev) => [...prev.slice(-80), `[${ev.step}] ${ev.line}`]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (forcedStep !== "install") return;
    let active = true;
    void fetchWebCfOAuthSessionPresent().then((present) => {
      if (!active || !present) return;
      setStep("install");
    });
    return () => {
      active = false;
    };
  }, [forcedStep]);

  useEffect(() => {
    if (step !== "install" || installBusy || installToken) return;
    let active = true;
    void (async () => {
      const res = await fetch("/api/oauth/session", { credentials: "include" });
      const data = (await res.json()) as { present?: boolean; accountId?: string };
      if (!active || !data.present || !data.accountId) return;
      await runInstall(data.accountId);
    })();
    return () => {
      active = false;
    };
  }, [step, installBusy, installToken, runInstall]);

  useEffect(() => {
    if (step !== "account" || !cfAccountId || username.trim()) return;
    let active = true;
    void fetch(
      `${getStudioApiBase()}/auth/suggest-username?cfAccountId=${encodeURIComponent(cfAccountId)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((body: { username?: string }) => {
        if (!active || !body.username) return;
        setUsername(body.username);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [step, cfAccountId, username]);

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (accountBusy || !installToken) return;
    if (password !== confirmPassword) {
      setAccountError("Passwords do not match.");
      return;
    }
    if (available === false) {
      setAccountError("That username is taken.");
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      await registerCloudAccount({
        username: username.trim(),
        password,
        confirmPassword,
        installToken,
      });
      router.replace("/studio/dashboard");
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setAccountBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <AuthPageBrandMark />
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Connect Cloudflare, install Relaybase, then pick a username.
        </p>
      </div>

      {step === "oauth" ? (
        <WebAuthorizeCard
          afterAuthPath="/signup?step=install"
          buttonLabel="Continue with Cloudflare"
        />
      ) : null}

      {step === "install" ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Installing on your Cloudflare account…</p>
          {installBusy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> This may take a few minutes.
            </p>
          ) : null}
          {installError ? <p className="text-sm text-destructive">{installError}</p> : null}
          {installLog.length > 0 ? (
            <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-xs">
              {installLog.join("\n")}
            </pre>
          ) : null}
          {installError ? (
            <Button type="button" variant="outline" onClick={() => setStep("oauth")}>
              Back
            </Button>
          ) : null}
        </div>
      ) : null}

      {step === "account" ? (
        <form onSubmit={submitAccount} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-username">Username</Label>
            <Input
              id="signup-username"
              name="relaybase-signup-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : available === false ? (
              <p className="text-xs text-destructive">Username is taken.</p>
            ) : available === true ? (
              <p className="text-xs text-muted-foreground">Username is available.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </div>
          {accountError ? <p className="text-sm text-destructive">{accountError}</p> : null}
          <Button type="submit" className="w-full" disabled={accountBusy}>
            {accountBusy ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
          </Button>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
