"use client";

import { Cloud, ExternalLink, Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useSettingsConnection } from "@/dashboard/components/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
  maskSecret,
} from "@/dashboard/components/settings/settings-shared";

export function SettingsCloudflarePage() {
  const {
    credentials,
    cfConnected,
    accountId,
    setAccountId,
    apiToken,
    setApiToken,
    cfEditing,
    setCfEditing,
    cfBusy,
    cfError,
    cfMessage,
    resetCfDraft,
    handleSaveCf,
  } = useSettingsConnection();

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Cloud}
        title="Cloudflare connection"
        description={
          <>
            Cloudflare API token used to import zones and — once the Worker is
            deployed — authorize it to send mail. Stored only in{" "}
            <span className="font-mono">~/.relaybase</span> and pushed to the
            Worker as <span className="font-mono">CF_ACCOUNT_ID</span> /{" "}
            <span className="font-mono">CF_API_TOKEN</span> secrets during
            install.
          </>
        }
        editing={cfEditing}
        onEdit={() => {
          resetCfDraft();
          setCfEditing(true);
        }}
      >
        <HealthStatus
          tone={cfConnected ? "ok" : "bad"}
          label={cfConnected ? "Connected" : "Not connected"}
          detail={
            cfConnected
              ? "API token saved locally and ready for zone assist."
              : "Add an Account ID and API token to import zones from Cloudflare."
          }
        />
        {cfEditing ? (
          <>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
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
                <Label htmlFor="settings-cf-account">Account ID</Label>
                <Input
                  id="settings-cf-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="32-char hex from Cloudflare dashboard"
                  className="font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-cf-token">API token</Label>
                <Input
                  id="settings-cf-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Paste token — stored locally"
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <DesktopErrorBanner error={cfError} />
            {cfMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {cfMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!accountId.trim() || !apiToken.trim() || cfBusy}
                onClick={() => void handleSaveCf()}
              >
                {cfBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Verify &amp; save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cfBusy}
                onClick={() => {
                  resetCfDraft();
                  setCfEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow
              label="Account ID"
              value={credentials?.accountId?.trim() || "—"}
            />
            <SummaryRow
              label="API token"
              value={maskSecret(credentials?.apiToken ?? "")}
            />
          </div>
        )}
      </ConnectionCard>
    </SettingsPageBody>
  );
}
