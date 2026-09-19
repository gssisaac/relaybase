"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPageBrandMark } from "@/console/components/setup/common/layout/AuthPageBrandMark";
import { resetCloudPasswordOAuth } from "@/lib/auth/cloud-session";
import { WebAuthorizeCard } from "@/console/components/setup/web/WebAuthorizeCard";
import { fetchWebCfOAuthSessionPresent } from "@/lib/desktop/bridge/web-oauth-complete";

export function ResetPasswordOAuthForm() {
  const router = useRouter();
  const [oauthReady, setOauthReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchWebCfOAuthSessionPresent().then(setOauthReady);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetCloudPasswordOAuth({ newPassword: password, confirmPassword });
      router.replace("/studio/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
      <AuthPageBrandMark />
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Prove Cloudflare account ownership, then set a new password.
        </p>
      </div>

      {!oauthReady ? (
        <WebAuthorizeCard
          afterAuthPath="/forgot-password?verified=1"
          buttonLabel="Verify with Cloudflare"
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
