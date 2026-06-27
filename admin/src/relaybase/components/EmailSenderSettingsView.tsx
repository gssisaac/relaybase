"use client";

import { useEffect, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import { EMAIL_SENDER_API } from "@/relaybase/components/constants";
import {
  EmailSenderAlerts,
  EmailSenderToolbar,
} from "@/relaybase/components/EmailSenderShared";
import type { EmailSenderConfigStatus } from "@/relaybase/components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CredentialInput } from "@/components/ui/credential-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmailSenderSettingsView() {
  const {
    config,
    loading,
    refreshing,
    configMeta,
    error: ctxError,
    refreshConfig,
    invalidateConfig,
  } = useEmailSender();
  const cacheHint = useEmailSenderCacheHint(configMeta);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [workerUrlInput, setWorkerUrlInput] = useState("");
  const [cfAccountIdInput, setCfAccountIdInput] = useState("");
  const [cfApiTokenInput, setCfApiTokenInput] = useState("");
  const [cfZoneIdInput, setCfZoneIdInput] = useState("");
  const [cfDnsTokenInput, setCfDnsTokenInput] = useState("");
  const [inboundR2BucketInput, setInboundR2BucketInput] = useState("");

  useEffect(() => {
    if (!config) return;
    setWorkerUrlInput(config.workerUrl ?? "");
    setCfAccountIdInput(config.cloudflareAccountId ?? "");
    setCfZoneIdInput(config.cloudflareZoneId ?? "");
    setInboundR2BucketInput(config.inboundR2BucketName ?? "");
    setCfApiTokenInput(config.cloudflareApiToken ?? "");
    setCfDnsTokenInput(config.cloudflareDnsApiToken ?? "");
  }, [config]);

  async function saveSettings() {
    const workerUrl = workerUrlInput.trim();
    if (!workerUrl) {
      setError("Worker URL is required");
      return;
    }
    if (!cfAccountIdInput.trim()) {
      setError("Cloudflare account ID is required");
      return;
    }
    if (!cfApiTokenInput.trim() && !config?.cloudflareConfigured) {
      setError("Cloudflare API token is required");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${EMAIL_SENDER_API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerUrl,
          cloudflareAccountId: cfAccountIdInput.trim(),
          cloudflareApiToken: cfApiTokenInput.trim() || undefined,
          cloudflareZoneId: cfZoneIdInput.trim() || undefined,
          cloudflareDnsApiToken: cfDnsTokenInput.trim() || undefined,
          inboundR2BucketName: inboundR2BucketInput.trim() || undefined,
        }),
      });
      const data = (await res.json()) as EmailSenderConfigStatus & {
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage(data.message ?? "Settings saved");
      invalidateConfig();
      await refreshConfig({ refresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <EmailSenderToolbar
        refreshing={refreshing}
        onRefresh={() => void refreshConfig({ refresh: true })}
        cacheHint={cacheHint}
      />
      <EmailSenderAlerts error={error ?? ctxError} message={message} />

      {loading && !config ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Worker connection</CardTitle>
          <CardDescription>
            Worker URL for Relaybase management APIs. Saving also provisions an
            internal worker link automatically — dashboard access tokens for
            products are issued separately on the Status tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-worker-url">Worker URL</Label>
            <Input
              id="email-sender-worker-url"
              value={workerUrlInput}
              onChange={(e) => setWorkerUrlInput(e.target.value)}
              placeholder="https://relaybase.example.workers.dev"
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cloudflare Email Sending</CardTitle>
          <CardDescription>
            Same credentials as MacPurity Email → Cloudflare. Synced to the worker
            when you save — this is what actually sends mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-cf-account">Cloudflare account ID</Label>
            <Input
              id="email-sender-cf-account"
              value={cfAccountIdInput}
              onChange={(e) => setCfAccountIdInput(e.target.value)}
              placeholder="32-character account ID"
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-cf-token">Cloudflare API token</Label>
            <CredentialInput
              id="email-sender-cf-token"
              value={cfApiTokenInput}
              onChange={(e) => setCfApiTokenInput(e.target.value)}
              placeholder={
                config?.cloudflareConfigured
                  ? "Saved — edit to replace"
                  : "Token with Account → Email Sending → Edit"
              }
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-cf-zone">Cloudflare zone ID (optional)</Label>
            <Input
              id="email-sender-cf-zone"
              value={cfZoneIdInput}
              onChange={(e) => setCfZoneIdInput(e.target.value)}
              placeholder="Auto-resolve from domain in Branding"
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-cf-dns-token">
              Cloudflare DNS API token (optional)
            </Label>
            <CredentialInput
              id="email-sender-cf-dns-token"
              value={cfDnsTokenInput}
              onChange={(e) => setCfDnsTokenInput(e.target.value)}
              placeholder="Zone → DNS → Edit (for Branding tab)"
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-inbound-r2-bucket">
              Inbound R2 bucket (shared)
            </Label>
            <Input
              id="email-sender-inbound-r2-bucket"
              value={inboundR2BucketInput}
              onChange={(e) => setInboundR2BucketInput(e.target.value)}
              placeholder="flare-email-inbound"
              disabled={saving}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Created automatically on save if missing. Mail is organized by
              domain under <span className="font-mono">inbound/&lt;domain&gt;/</span>{" "}
              inside this bucket. Must match{" "}
              <span className="font-mono">bucket_name</span> and{" "}
              <span className="font-mono">INBOUND_BUCKET_NAME</span> in{" "}
              <span className="font-mono">wrangler.toml</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void saveSettings()}
              disabled={saving || !workerUrlInput.trim() || !cfAccountIdInput.trim()}
            >
              {saving ? "Saving…" : "Save and sync to worker"}
            </Button>
            {config?.configured ? (
              <Badge variant={config.healthy ? "default" : "destructive"}>
                {config.healthy ? "Worker healthy" : "Worker unreachable"}
              </Badge>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
