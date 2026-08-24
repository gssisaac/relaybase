"use client";

import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOpenEnableEmailApiDialog } from "@/console/components/setup/use-enable-email-api-dialog";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
} from "@/console/pages/settings/settings-shared";

export function SettingsCloudflarePage() {
  const {
    credentials,
    workerStatus,
    cfConnected,
    handleRefreshStatus,
    resetCfDraft,
  } = useSettingsConnection();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();

  const accountId =
    workerStatus?.accountId?.trim() || credentials?.accountId?.trim() || "";
  const scriptName =
    workerStatus?.workerScriptName?.trim() ||
    credentials?.workerScriptName?.trim() ||
    "relaybase-api";
  const workerUrl =
    workerStatus?.workerUrl?.trim() || credentials?.workerUrl?.trim() || "";
  const adminToken = credentials?.adminToken?.trim() || "";

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Shield}
        title="Cloudflare API (domains and routing)"
        description={
          <>
            Needed to send email and to register and manage accounts. Create a
            Cloudflare API token, add it as a{" "}
            <span className="font-mono">CF_API_TOKEN</span> secret on your
            Worker, then verify.
          </>
        }
      >
        <HealthStatus
          tone={cfConnected ? "ok" : "bad"}
          label={cfConnected ? "Configured" : "Not configured"}
          detail={
            cfConnected
              ? "CF_API_TOKEN is set on the Worker and Cloudflare accepted it."
              : "Use Enable email API to add the token, then verify."
          }
        />

        {cfConnected ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryRow label="Account ID" value={accountId || "—"} />
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              resetCfDraft();
              openEnableEmailApiDialog({
                accountId,
                workerScriptName: scriptName,
                workerUrl,
                adminToken,
              });
            }}
          >
            {cfConnected ? "Set up again" : "Enable email API"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleRefreshStatus()}
          >
            Verify again
          </Button>
        </div>
      </ConnectionCard>
    </SettingsPageBody>
  );
}
