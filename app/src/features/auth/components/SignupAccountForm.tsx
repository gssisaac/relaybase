"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSignupSession, readSignupInstallToken } from "@/features/auth/lib/signup-session";
import { useIdAvailability } from "@/features/auth/hooks/useIdAvailability";
import { registerCloudAccount } from "@/lib/auth/cloud-session";
import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function SignupAccountForm() {
  const router = useRouter();
  const [installToken, setInstallToken] = useState("");
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfAccountName, setCfAccountName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setPasswordConfirm] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const { available, checking, hint } = useIdAvailability(username, Boolean(installToken));

  useEffect(() => {
    const session = readSignupInstallToken();
    if (!session) {
      router.replace("/signup");
      return;
    }
    setInstallToken(session.installToken);
    setCfAccountId(session.cfAccountId);
    setCfAccountName(session.cfAccountName || "");
  }, [router]);

  useEffect(() => {
    if (!cfAccountId || username.trim()) return;
    let active = true;
    const qs = new URLSearchParams({ cfAccountId });
    if (cfAccountName) qs.set("cfAccountName", cfAccountName);
    void fetch(`${getStudioApiBase()}/auth/suggest-username?${qs.toString()}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((body: { username?: string }) => {
        if (!active || !body.username) return;
        setUsername(body.username);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cfAccountId, cfAccountName, username]);

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
      clearSignupSession();
      router.replace("/onboarding");
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setAccountBusy(false);
    }
  }

  if (!installToken) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </p>
    );
  }

  return (
    <>
      <form onSubmit={submitAccount} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-username">Username</Label>
          <Input
            id="signup-username"
            name="relaybase-signup-username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
            {checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : hint ? (
              <p className="text-xs text-destructive">{hint}</p>
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
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
