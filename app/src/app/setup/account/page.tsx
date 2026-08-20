"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  desktopOpenExternal,
  desktopSaveRelaybaseAccount,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { SetupCenteredPage } from "@/console/components/setup/setup-page-chrome";

const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.relaybase.xyz";

type AccountResponse = {
  ok?: boolean;
  error?: string;
  account?: { id: string; email: string; createdAt: string };
  sessionToken?: string;
};

export default function SetupAccountPage() {
  const router = useRouter();
  const { credentials, refresh } = useDesktop();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);

  const alreadyConnected = Boolean(
    credentials?.relaybaseAccountId && credentials?.relaybaseSession,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${CONSOLE_URL.replace(/\/$/, "")}/api/v1/account?action=login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        },
      );
      const data = (await res.json()) as AccountResponse;
      if (!res.ok || !data.ok || !data.account) {
        throw new Error(data.error ?? "Login failed");
      }
      await desktopSaveRelaybaseAccount({
        accountId: data.account.id,
        email: data.account.email,
        session: data.sessionToken ?? "",
        tier: "free",
      });
      await refresh?.();
      router.replace(alreadyConnected ? "/" : "/setup/install");
    } catch (err) {
      setError(explainDesktopError(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupCenteredPage>
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to Relaybase
          </h1>
          <p className="text-xs text-muted-foreground">
            This sign-in is for invited teammates only. New accounts are
            created by your admin on the Relaybase console — Relaybase does
            not create accounts from this screen.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DesktopErrorBanner error={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => void desktopOpenExternal(`${CONSOLE_URL}/recover`)}
          >
            Forgot your password?
          </button>
        </div>
      </div>
    </SetupCenteredPage>
  );
}
