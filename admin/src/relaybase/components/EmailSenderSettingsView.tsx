"use client";

import { useEffect, useMemo, useState } from "react";

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

type SettingFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  secret?: boolean;
  disabled?: boolean;
};

function SettingField({
  id,
  label,
  value,
  onChange,
  placeholder,
  description,
  secret = false,
  disabled = false,
}: Omit<SettingFieldProps, "fromEnv">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {secret ? (
        <CredentialInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono text-xs"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono text-xs"
        />
      )}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

const FIELD_DEFS = [
  {
    key: "workerUrl" as const,
    id: "email-sender-worker-url",
    label: "Worker URL",
    placeholder: "https://relaybase.example.workers.dev",
  },
  {
    key: "cloudflareAccountId" as const,
    id: "email-sender-cf-account",
    label: "Cloudflare account ID",
    placeholder: "32-character account ID",
  },
  {
    key: "cloudflareApiToken" as const,
    id: "email-sender-cf-token",
    label: "Cloudflare API token",
    placeholder: "Token with Account → Email Sending → Edit",
    secret: true,
  },
  {
    key: "cloudflareZoneId" as const,
    id: "email-sender-cf-zone",
    label: "Cloudflare zone ID (optional)",
    placeholder: "Auto-resolve from domain in Branding",
  },
  {
    key: "cloudflareDnsApiToken" as const,
    id: "email-sender-cf-dns-token",
    label: "Cloudflare DNS API token (optional)",
    placeholder: "Zone → DNS → Edit (for Branding tab)",
    secret: true,
  },
  {
    key: "inboundR2BucketName" as const,
    id: "email-sender-inbound-r2-bucket",
    label: "Inbound R2 bucket (shared)",
    placeholder: "flare-email-inbound",
    description:
      "Created automatically on save if missing. Mail is organized by domain under inbound/<domain>/ inside this bucket.",
  },
];

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
  const [inputs, setInputs] = useState({
    workerUrl: "",
    cloudflareAccountId: "",
    cloudflareApiToken: "",
    cloudflareZoneId: "",
    cloudflareDnsApiToken: "",
    inboundR2BucketName: "",
  });

  const envSources = config?.envSources;
  const envLoaded = envSources !== undefined;

  const visibleFields = useMemo(
    () => FIELD_DEFS.filter((field) => !envSources?.[field.key]),
    [envSources],
  );

  const hasEditableFields = visibleFields.length > 0;

  useEffect(() => {
    if (config && !config.envSources) {
      void refreshConfig({ refresh: true });
    }
  }, [config, refreshConfig]);

  useEffect(() => {
    if (!config) return;
    setInputs({
      workerUrl: config.workerUrl ?? "",
      cloudflareAccountId: config.cloudflareAccountId ?? "",
      cloudflareZoneId: config.cloudflareZoneId ?? "",
      inboundR2BucketName: config.inboundR2BucketName ?? "",
      cloudflareApiToken: config.cloudflareApiToken ?? "",
      cloudflareDnsApiToken: config.cloudflareDnsApiToken ?? "",
    });
  }, [config]);

  async function saveSettings() {
    const workerUrl = (envSources?.workerUrl
      ? config?.workerUrl
      : inputs.workerUrl
    )?.trim() ?? "";
    const cloudflareAccountId = (envSources?.cloudflareAccountId
      ? config?.cloudflareAccountId
      : inputs.cloudflareAccountId
    )?.trim() ?? "";
    const cloudflareApiToken = (envSources?.cloudflareApiToken
      ? config?.cloudflareApiToken
      : inputs.cloudflareApiToken
    )?.trim() ?? "";

    if (!workerUrl) {
      setError("Worker URL is required");
      return;
    }
    if (!cloudflareAccountId) {
      setError("Cloudflare account ID is required");
      return;
    }
    if (!cloudflareApiToken && !config?.cloudflareConfigured) {
      setError("Cloudflare API token is required");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, string | undefined> = {};
      for (const field of visibleFields) {
        const value = inputs[field.key].trim();
        body[field.key] = value || undefined;
      }

      const res = await fetch(`${EMAIL_SENDER_API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const canSave =
    envLoaded &&
    ((hasEditableFields &&
      inputs.workerUrl.trim() &&
      inputs.cloudflareAccountId.trim()) ||
      (!hasEditableFields &&
        config?.workerUrl?.trim() &&
        config?.cloudflareAccountId?.trim()));

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

      {!envLoaded && config ? (
        <p className="text-sm text-muted-foreground">Loading environment…</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Relaybase settings</CardTitle>
          <CardDescription>
            {hasEditableFields
              ? "Missing values can be set here and saved to local storage. Fields configured in .env.local are hidden."
              : "All settings are loaded from .env.local. Update the file and restart the admin app to change them."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleFields.map((field) => (
            <SettingField
              key={field.key}
              id={field.id}
              label={field.label}
              value={inputs[field.key]}
              onChange={(value) =>
                setInputs((current) => ({ ...current, [field.key]: value }))
              }
              placeholder={field.placeholder}
              description={field.description}
              secret={field.secret}
              disabled={saving}
            />
          ))}

          {!hasEditableFields && envLoaded ? (
            <p className="text-sm text-muted-foreground">
              Worker URL, Cloudflare credentials, and inbound bucket are configured
              via environment variables.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {envLoaded ? (
              <Button
                size="sm"
                onClick={() => void saveSettings()}
                disabled={saving || !canSave}
              >
                {saving
                  ? "Saving…"
                  : hasEditableFields
                    ? "Save and sync to worker"
                    : "Sync to worker"}
              </Button>
            ) : null}
            {config?.configured ? (
              <>
                <Badge variant={config.healthy ? "default" : "destructive"}>
                  {config.healthy ? "Worker healthy" : "Worker unreachable"}
                </Badge>
                {!config.workerLinked ? (
                  <Badge variant="secondary">Not synced — click Sync to worker</Badge>
                ) : null}
                {config.inboundR2Mismatch ? (
                  <Badge variant="destructive">
                    R2 bucket mismatch (worker: {config.inboundR2WorkerBucketName})
                  </Badge>
                ) : null}
              </>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
