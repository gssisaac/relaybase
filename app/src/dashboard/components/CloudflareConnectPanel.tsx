"use client";

import { ExternalLink, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  desktopOpenExternal,
  desktopSaveCfCredentials,
  desktopVerifyCfToken,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";

export function CloudflareConnectPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [accountId, setAccountId] = useState(credentials?.accountId ?? "");
  const [apiToken, setApiToken] = useState(credentials?.apiToken ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (credentials?.accountId) setAccountId(credentials.accountId);
    if (credentials?.apiToken) setApiToken(credentials.apiToken);
  }, [credentials?.accountId, credentials?.apiToken]);

  async function handleVerifyAndContinue() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await desktopVerifyCfToken(accountId, apiToken);
      if (!result.ok) throw new Error(result.message);
      await desktopSaveCfCredentials(accountId, apiToken);
      setMessage("Token verified and saved to ~/.relaybase/credentials.json.");
      await refresh();
      router.push("/setup/install");
    } catch (err) {
      setError(explainDesktopError(err, "Token verification failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 of 3
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Connect Cloudflare
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Relaybase runs entirely in <strong>your</strong> Cloudflare account.
          Create an API token with the scopes below. Worker install happens on
          the next page after we verify what already exists.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Shield className="size-3.5" />
          Required token permissions
        </div>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 text-brand hover:underline"
          onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
        >
          Create token in Cloudflare
          <ExternalLink className="size-3" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-account">Account ID</Label>
          <Input
            id="cf-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="32-char hex from Cloudflare dashboard"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-token">API token</Label>
          <Input
            id="cf-token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Paste token — stored locally in ~/.relaybase"
            className="font-mono text-xs"
          />
        </div>
      </div>

      <DesktopErrorBanner error={error} />
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!accountId || !apiToken || busy}
          onClick={() => void handleVerifyAndContinue()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Verify &amp; continue
        </Button>
      </div>
    </div>
  );
}
