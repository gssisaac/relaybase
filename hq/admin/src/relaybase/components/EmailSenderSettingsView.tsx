"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useEmailSender,
  useEmailSenderCacheHint,
} from "@/relaybase/components/EmailSenderContext";
import { RELAYBASE_API } from "@/relaybase/components/constants";
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
    id: "relaybase-worker-url",
    label: "Worker URL",
    placeholder: "https://relaybase-api.gssisaac.worker.dev",
    description:
      "Public /health only. HQ does not store an owner passtoken or call /console/*.",
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
  });

  const envSources = config?.envSources;
  const envLoaded = envSources !== undefined;

  const visibleFields = useMemo(
    () => FIELD_DEFS.filter((field) => !envSources?.workerUrl || field.key !== "workerUrl"),
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
    });
  }, [config]);

  async function saveSettings() {
    const workerUrl = (envSources?.workerUrl
      ? config?.workerUrl
      : inputs.workerUrl
    )?.trim() ?? "";

    if (!workerUrl) {
      setError("Worker URL is required");
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

      const res = await fetch(`${RELAYBASE_API}/config`, {
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
    ((hasEditableFields && inputs.workerUrl.trim()) ||
      (!hasEditableFields && config?.workerUrl?.trim()));

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
              ? "Operator config for reaching the product worker. Cloudflare credentials, DMARC branding, and send logs live on the worker (wrangler secrets + /console routes)."
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
              Worker URL is configured via environment variables.
            </p>
          ) : null}

          {config?.diagnostics?.checks.some((check) => !check.ok) ? (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                Configuration issues
              </p>
              <ul className="space-y-2 text-sm">
                {config.diagnostics.checks
                  .filter((check) => !check.ok)
                  .map((check) => (
                    <li key={check.id}>
                      <p className="font-medium">{check.summary}</p>
                      {check.detail ? (
                        <p className="text-muted-foreground">{check.detail}</p>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {envLoaded ? (
              <Button
                size="sm"
                onClick={() => void saveSettings()}
                disabled={saving || !canSave}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
            {config?.configured ? (
              <>
                <Badge variant={config.healthy ? "default" : "destructive"}>
                  {config.healthy ? "Worker healthy" : "Worker unreachable"}
                </Badge>
                <Badge variant="secondary">
                  HQ does not hold an owner passtoken
                </Badge>
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
