"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerUrlPicker } from "@/console/components/setup/WorkerUrlPicker";
import { resolveWorkerUrl } from "@/lib/desktop/app-session/resolve-worker-url";
import { useAppSession } from "@/lib/desktop/app-session";
import { rememberWorkerUrl } from "@/lib/desktop/worker-url/recent-worker-urls";
import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";
import { useDesktop } from "@/lib/desktop/shell";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { explainDesktopError, type DesktopErrorHelp } from "@/lib/desktop/bridge";

/**
 * Invited (team) login form. Verifies the mobile password against the
 * customer Worker via the store, which then stores it in the OS keyring.
 * The standalone `/login` page delegates here.
 */
export function TeamLoginView() {
  const store = useAppSession();
  const { teamLogin } = useDesktop();

  const savedWorkerUrl = resolveWorkerUrl({
    role: "invited",
    ownerStatus: store.ownerStatus,
    teamStatus: store.teamStatus,
    credentials: null,
    teamLogin,
  });

  const workerUrlSeeds = useMemo(
    () => [teamLogin?.workerUrl, store.teamStatus?.workerUrl],
    [teamLogin?.workerUrl, store.teamStatus?.workerUrl],
  );

  const [workerUrl, setWorkerUrl] = useState(savedWorkerUrl ?? "");
  const [accountEmail, setAccountEmail] = useState(teamLogin?.accountEmail ?? "");
  const [mobilePassword, setMobilePassword] = useState("");
  const [error, setError] = useState<DesktopErrorHelp | null>(null);

  const selectedUrl = normalizeWorkerUrl(workerUrl);
  const canSubmit =
    Boolean(selectedUrl) &&
    Boolean(accountEmail.trim()) &&
    Boolean(mobilePassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = selectedUrl;
    const email = accountEmail.trim().toLowerCase();
    const password = mobilePassword;
    if (!url || !email || !password) {
      setError({
        title: "All fields are required",
        detail:
          "Select a Worker URL, enter your account email, and mobile password.",
        fix: "Ask your team admin for the Worker URL and your mobile password.",
      });
      return;
    }
    setError(null);
    try {
      await store.loginInvited({
        workerUrl: url,
        accountEmail: email,
        mobilePassword: password,
      });
      rememberWorkerUrl(url);
    } catch (err) {
      setError(explainDesktopError(err, "Team login failed"));
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-10">
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Team login</h1>
          <p className="text-xs text-muted-foreground">
            For teammates. Sign in with your account email and the mobile
            password your admin set up in Accounts → Other device. You only get
            inbox access — no management console.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <WorkerUrlPicker
            value={workerUrl}
            onChange={setWorkerUrl}
            seedUrls={workerUrlSeeds}
            disabled={store.busy}
          />
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-password">Mobile password</Label>
            <Input
              id="mobile-password"
              type="password"
              autoComplete="current-password"
              required
              value={mobilePassword}
              onChange={(e) => setMobilePassword(e.target.value)}
            />
          </div>
          <DesktopErrorBanner error={error} />
          <Button
            type="submit"
            className="w-full"
            disabled={store.busy || !canSubmit}
          >
            {store.busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          Admin?{" "}
          <Link href="/setup" className="hover:underline">
            Set up or log in to your Relaybase account
          </Link>
        </div>
      </div>
    </div>
  );
}
