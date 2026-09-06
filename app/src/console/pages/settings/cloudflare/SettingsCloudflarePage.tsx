"use client";

import { Loader2, Shield } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useOpenEnableEmailApiDialog } from "@/console/components/setup/use-enable-email-api-dialog";
import { CfApiTokenDetailsSheet } from "@/console/pages/settings/cloudflare/CfApiTokenDetailsSheet";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
  maskAccountId,
} from "@/console/pages/settings/settings-shared";
import { displayCfAccountId } from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";

export function SettingsCloudflarePage() {
  const {
    credentials,
    workerStatus,
    cfConnected,
    cfBusy,
    cfError,
    cfMessage,
    handleVerifyCf,
    resetCfDraft,
  } = useSettingsConnection();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const accountId = displayCfAccountId({
    workerAccountId: workerStatus?.accountId,
    credentialsAccountId: credentials?.accountId,
  });
  const scriptName =
    workerStatus?.workerScriptName?.trim() ||
    credentials?.workerScriptName?.trim() ||
    "relaybase-api";
  const workerUrl =
    workerStatus?.workerUrl?.trim() || credentials?.workerUrl?.trim() || "";

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Shield}
        title="Cloudflare API (domains and routing)"
        description={
          <>
            The API token is for the Cloudflare REST API — inbox routing, MX,
            and DMARC — not for sending. Create a Cloudflare API token, add it
            on your Worker, then verify.{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-sm"
              onClick={() => setDetailsOpen(true)}
            >
              View details
            </Button>
          </>
        }
      >
        <HealthStatus
          tone={cfBusy ? "pending" : cfConnected ? "ok" : "bad"}
          label={
            cfBusy
              ? "Verifying API token…"
              : cfConnected
                ? "Configured"
                : "Not configured"
          }
          detail={
            cfBusy
              ? "Probing Cloudflare API token permissions on the Worker."
              : cfConnected
                ? "The API token is set on the Worker and Cloudflare accepted it."
                : "Use Enable email API to add the token, then verify."
          }
        />

        {cfConnected ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow
              label="Account ID"
              value={accountId ? maskAccountId(accountId) : "—"}
            />
            <SummaryRow label="API token" value="Set on Worker" />
            <SummaryRow
              label="Sending"
              value={
                workerStatus?.emailBindingConfigured
                  ? "EMAIL binding"
                  : "REST fallback (no EMAIL binding)"
              }
            />
          </div>
        ) : null}

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
            disabled={cfBusy}
            onClick={() => {
              resetCfDraft();
              openEnableEmailApiDialog({
                accountId,
                workerScriptName: scriptName,
                workerUrl,
              });
            }}
          >
            {cfConnected ? "Set up again" : "Enable email API"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cfBusy}
            onClick={() => void handleVerifyCf()}
          >
            {cfBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Verify again
          </Button>
        </div>
      </ConnectionCard>
      <CfApiTokenDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} />
    </SettingsPageBody>
  );
}
