"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hqLogin } from "@/lib/hq-auth/session";

function redirectAfterAuth(router: ReturnType<typeof useRouter>, next: string | null) {
  if (next?.startsWith("/")) {
    router.push(next);
    return;
  }
  router.push("/studio/overview");
}

/** HQ Cloud sign-in only — `/cloud/login`. */
export function HqCloudLoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(email.trim() && password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await hqLogin({ email: email.trim(), password });
      redirectAfterAuth(router, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  const signupHref = next
    ? `/cloud/signup?next=${encodeURIComponent(next)}`
    : "/cloud/signup";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Relaybase Cloud</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to Studio and cloud features.
          </p>
        </div>

        <form
          className="space-y-4"
          name="relaybase-cloud-signin"
          autoComplete="on"
          onSubmit={handleSubmit}
        >
          <div className="space-y-1.5">
            <Label htmlFor="hq-login-email">Email</Label>
            <Input
              id="hq-login-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="section-relaybase-cloud email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hq-login-password">Password</Label>
            <Input
              id="hq-login-password"
              name="password"
              type="password"
              autoComplete="section-relaybase-cloud current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to Relaybase Cloud?{" "}
          <Link href={signupHref} className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Mailbox &amp; Console without Cloud?{" "}
          <Link href="/worker/login" className="hover:underline">
            Connect your Worker
          </Link>
        </p>
      </div>
    </div>
  );
}
