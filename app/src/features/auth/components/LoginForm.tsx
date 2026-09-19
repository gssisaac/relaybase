"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageBrandMark } from "@/console/components/setup/common/layout/AuthPageBrandMark";
import { resolveCloudOwnerLandingPath } from "@/features/onboarding/lib/needs-cloud-onboarding";
import { cloudLogin } from "@/lib/auth/cloud-session";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await cloudLogin({ username: username.trim(), password });
      const landing = await resolveCloudOwnerLandingPath(next);
      router.replace(landing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
      <AuthPageBrandMark />
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Your Relaybase username and password</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-username">Username</Label>
          <Input
            id="login-username"
            name="relaybase-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="relaybase-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="hover:underline">
          Forgot password
        </Link>
        {" · "}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
