"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMailRuntime } from "@/mail-platform/runtime";

/**
 * Email-mode login — account email + per-account mobile password.
 *
 * Verifies against `GET /mobile/config` on the customer Worker, then
 * stores the identity in `sessionStorage` (password in memory only).
 */
export default function EmailLoginPage() {
  const router = useRouter();
  const { session } = useMailRuntime();
  const [workerUrl, setWorkerUrl] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [mobilePassword, setMobilePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await session.login({ workerUrl, accountEmail, mobilePassword });
      router.replace("/inbox");
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
            Sign in with your account email and password.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="worker-url">Worker URL</Label>
            <Input
              id="worker-url"
              type="url"
              required
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
              placeholder="https://your-worker.example.workers.dev"
              disabled={busy}
            />
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="mobile-password">Password</Label>
            <Input
              id="mobile-password"
              type="password"
              autoComplete="current-password"
              required
              value={mobilePassword}
              onChange={(e) => setMobilePassword(e.target.value)}
              disabled={busy}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
