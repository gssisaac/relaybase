"use client";

import { ExternalLink, Loader2, Shield, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { formatRelativeDate } from "@/lib/utils";
import { useSettingsConnection } from "@/dashboard/components/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
  maskSecret,
} from "@/dashboard/components/settings/settings-shared";

function accessTokenExpiryDetail(iso: string): string {
  const expiresAt = new Date(iso);
  if (Number.isNaN(expiresAt.getTime())) return "";
  const relative = formatRelativeDate(iso);
  if (expiresAt.getTime() <= Date.now()) {
    return ` Access token expired ${relative}.`;
  }
  return ` Access token expires ${relative}.`;
}

export function SettingsCloudflarePage() {
  const {
    credentials,
    cfConnected,
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
    cfOAuthConnected,
    cfOAuthAccountId,
    cfOAuthExpiresAt,
    oauthBusy,
    oauthError,
    handleStartCfOAuth,
  } = useSettingsConnection();

  return (
    <SettingsPageBody>
      {/* Cloudflare account via OAuth — replaces the manually-pasted install
          token (Workers Scripts / KV / R2 Edit). The OAuth callback lives on
          console.relaybase.xyz (confidential client); the desktop stores the
          short-lived access token + refresh token in ~/.relaybase and
          refreshes via the console. This is the token used by wrangler to
          push the server token (CF_API_TOKEN) to the Worker. */}
      <ConnectionCard
        icon={cfOAuthConnected ? ShieldCheck : Shield}
        title="Cloudflare account (OAuth)"
        description={
          <>
            Connect your Cloudflare account to authorize Relaybase to deploy
            and push secrets (Workers Scripts / KV / R2 Edit). Done via
            Cloudflare OAuth — no token to paste. The access token is
            short-lived and refreshed automatically through the Relaybase
            console.
          </>
        }
      >
        <HealthStatus
          tone={cfOAuthConnected ? "ok" : "bad"}
          label={
            cfOAuthConnected
              ? "Connected via OAuth"
              : "Not connected"
          }
          detail={
            cfOAuthConnected
              ? `Account ${cfOAuthAccountId || credentials?.accountId || "—"} is authorized. Relaybase can deploy and push secrets.${
                  cfOAuthExpiresAt
                    ? accessTokenExpiryDetail(cfOAuthExpiresAt)
                    : ""
                }`
              : "Click Connect with Cloudflare to authorize Relaybase. You'll be sent to Cloudflare to approve, then return here."
          }
        />
        <DesktopErrorBanner error={oauthError} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={oauthBusy}
            onClick={() => void handleStartCfOAuth()}
          >
            {oauthBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {cfOAuthConnected ? "Reconnect with Cloudflare" : "Connect with Cloudflare"}
          </Button>
        </div>
      </ConnectionCard>

      {/* Server token — Account → Email Sending → Edit. Pushed to the Worker
          as the CF_API_TOKEN wrangler secret so the Worker can send mail.
          This is the only Cloudflare token managed in Settings; the install
          token (Workers Scripts/KV/R2 Edit) is obtained via OAuth above. */}
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
                The install token (Workers Scripts / KV / R2 Edit) is obtained
                via the OAuth connection above — there is no separate install
                token to paste. Connect with Cloudflare first if you haven&apos;t.
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
                  !serverToken.trim() || cfBusy || !cfOAuthConnected
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
            {!cfOAuthConnected ? (
              <p className="text-xs text-muted-foreground">
                Connect your Cloudflare account (above) first — Relaybase
                needs the OAuth install token to push the server token to the
                Worker.
              </p>
            ) : null}
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
