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
import { displayCfAccountId, cloudflareWorkerSettingsUrl, cfApiTokenHealth, cfApiTokenPermissionsRejected } from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/shell";

export function SettingsCloudflarePage() {
  const {
    credentials,
    workerStatus,
    cfConnected,
    cfBusy,
    statusBusy,
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
  const cfHealth = cfApiTokenHealth(workerStatus, {
    pending: cfBusy || (statusBusy && !workerStatus?.cfApiTokenSet),
  });
  const cfTokenOnWorker = Boolean(workerStatus?.cfApiTokenSet);
  const cfPermissionsRejected = cfApiTokenPermissionsRejected(workerStatus);

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Shield}
        title="Cloudflare API (domains and routing)"
        consoleLink={{
          href: cloudflareWorkerSettingsUrl(accountId, scriptName),
          label: "Worker settings",
        }}
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
          tone={cfHealth.tone}
          label={cfHealth.label}
          detail={cfHealth.detail}
        />

        {cfConnected || cfTokenOnWorker ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow
              label="Account ID"
              value={accountId ? maskAccountId(accountId) : "—"}
            />
            <SummaryRow
              label="API token"
              value={
                cfConnected
                  ? "Set on Worker"
                  : cfPermissionsRejected
                    ? "Set on Worker — permissions rejected"
                    : "Set on Worker"
              }
            />
            {cfConnected ? (
              <SummaryRow
                label="Sending"
                value={
                  workerStatus?.emailBindingConfigured
                    ? "EMAIL binding"
                    : "REST fallback (no EMAIL binding)"
                }
              />
            ) : null}
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
            {cfConnected
              ? "Set up again"
              : cfPermissionsRejected
                ? "Update API token"
                : "Enable email API"}
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
