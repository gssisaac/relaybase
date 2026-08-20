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
    serverToken,
    setServerToken,
    serverTokenPushed,
    cfEditing,
    setCfEditing,
    cfBusy,
    serverPushBusy,
    cfError,
    cfMessage,
    resetCfDraft,
    handleSaveServerToken,
  } = useSettingsConnection();

  return (
    <SettingsPageBody>
      {/* Server token — Account → Email Sending → Edit. Pushed to the Worker
          as the CF_API_TOKEN wrangler secret so the Worker can send mail.
          This is the only Cloudflare token managed in Settings; the install
          token (Workers Scripts/KV/R2 Edit) is collected during install only
          and reused by Tauri wrangler under the hood. */}
      <ConnectionCard
        icon={Shield}
        title="Cloudflare server token (Email Sending)"
        description={
          <>
            Token with Account → Email Sending → Edit. Pushed to the Worker as
            the <span className="font-mono">CF_API_TOKEN</span> wrangler secret
            so the Worker can send mail. Stored locally and pushed via{" "}
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
          label={
            cfConnected
              ? "Pushed to Worker"
              : serverToken.trim()
                ? "Saved locally — not pushed"
                : "Not set"
          }
          detail={
            cfConnected
              ? "Server token saved and pushed to the Worker. Sending is enabled."
              : serverToken.trim()
                ? "Saved locally but not pushed. Click Verify, save & push to enable sending."
                : "Add an Email Sending Edit token and push it to enable sending."
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
                The install token (Workers Scripts / KV / R2 Edit) is not
                managed here — it is collected during install and reused to
                push this server token to the Worker.
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
            {cfMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {cfMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  !accountId.trim() || !serverToken.trim() || cfBusy
                }
                onClick={() => void handleSaveServerToken()}
              >
                {serverPushBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Verify, save &amp; push
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
              label="Server token"
              value={maskSecret(credentials?.serverToken ?? "")}
            />
            <SummaryRow
              label="Push status"
              value={serverTokenPushed ? "Pushed to Worker" : "Not pushed"}
            />
          </div>
        )}
      </ConnectionCard>
    </SettingsPageBody>
  );
}
