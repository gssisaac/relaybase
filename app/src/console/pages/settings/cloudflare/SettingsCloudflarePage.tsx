"use client";

import { ExternalLink, Loader2, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
  maskSecret,
} from "@/console/pages/settings/settings-shared";

export function SettingsCloudflarePage() {
  const {
    credentials,
    workerStatus,
    cfConnected,
    serverToken,
    setServerToken,
    cfEditing,
    setCfEditing,
    cfBusy,
    serverPushBusy,
    cfError,
    cfMessage,
    resetCfDraft,
    handleSaveServerToken,
    cfInstallTokenAvailable,
    oauthBusy,
    oauthError,
  } = useSettingsConnection();

  // Live Worker probe: the Worker's CF_API_TOKEN secret is the source of
  // truth for whether sending is configured (device-local storage is not a
  // management signal).
  const accountId =
    workerStatus?.accountId?.trim() || credentials?.accountId?.trim() || "—";

  return (
    <SettingsPageBody>
      {/* Server token — Account → Email Sending → Edit. Pushed to the Worker
          as the CF_API_TOKEN wrangler secret so the Worker can send mail.
          This is the only Cloudflare token managed in Settings. The install
          token (Workers Scripts / KV / R2 Edit) is obtained via a short-lived
          Cloudflare OAuth authorization requested at push time and kept in
          memory only — cleared on app restart. */}
      <ConnectionCard
        icon={Shield}
        title="Cloudflare server token (Email Sending)"
        description={
          <>
            Token with Account → Email Sending → Edit. Pushed to the Worker as
            the <span className="font-mono">CF_API_TOKEN</span> wrangler secret
            so the Worker can send mail. Pushed via{" "}
            <span className="font-mono">wrangler secret put</span>; never
            written to KV.
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
          label={cfConnected ? "Configured" : "Not configured"}
          detail={
            cfConnected
              ? "Email Sending Edit token pushed to the Worker as the CF_API_TOKEN secret. Sending is enabled."
              : "Add an Email Sending Edit token and push it to the Worker to enable sending."
          }
        />
        {cfEditing ? (
          <>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <Shield className="size-3.5" />
                Required server token permissions
              </div>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                The install token (Workers Scripts / KV / R2 Edit) is requested
                via a short-lived Cloudflare authorization when you push — there
                is no separate install token to paste. The authorization is
                kept in memory only and cleared on app restart.
              </p>
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
                <Label htmlFor="settings-cf-server-token">Server token</Label>
                <Input
                  id="settings-cf-server-token"
                  type="password"
                  value={serverToken}
                  onChange={(e) => setServerToken(e.target.value)}
                  placeholder="Email Sending Edit — pushed to Worker as CF_API_TOKEN"
                  className="font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <DesktopErrorBanner error={cfError} />
            <DesktopErrorBanner error={oauthError} />
            {cfMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {cfMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!serverToken.trim() || cfBusy || oauthBusy}
                onClick={() => void handleSaveServerToken()}
              >
                {serverPushBusy || oauthBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {cfInstallTokenAvailable
                  ? "Verify, save & push"
                  : "Authorize & push"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cfBusy || oauthBusy}
                onClick={() => {
                  resetCfDraft();
                  setCfEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
            {!cfInstallTokenAvailable ? (
              <p className="text-xs text-muted-foreground">
                Relaybase needs a short-lived Cloudflare authorization to push
                the server token. Click Authorize &amp; push to approve in your
                browser — the token stays in memory only and is cleared on
                restart.
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow label="Account ID" value={accountId} />
            <SummaryRow
              label="Server token"
              value={maskSecret(credentials?.serverToken ?? "")}
            />
            <SummaryRow
              label="Push status"
              value={cfConnected ? "Pushed to the Worker" : "Not pushed"}
            />
          </div>
        )}
      </ConnectionCard>
    </SettingsPageBody>
  );
}
