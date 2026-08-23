"use client";

import { useState } from "react";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EnableEmailApiDialog } from "@/console/components/setup/EnableEmailApiDialog";
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
    serverToken,
    cfBusy,
    serverPushBusy,
    cfError,
    cfMessage,
    handlePasteServerToken,
    cfInstallTokenAvailable,
    oauthBusy,
    oauthError,
    handleRefreshStatus,
    resetCfDraft,
  } = useSettingsConnection();

  const [dialogOpen, setDialogOpen] = useState(false);

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
            A <span className="font-mono">CF_API_TOKEN</span> secret on your
            Worker lets Relaybase add inboxes and DNS. Sending uses the Worker{" "}
            <span className="font-mono">EMAIL</span> binding — you do not paste
            a token for send.
          </>
        }
      >
        <HealthStatus
          tone={cfConnected ? "ok" : "bad"}
          label={cfConnected ? "Configured" : "Not configured"}
          detail={
            cfConnected
              ? "CF_API_TOKEN is set on the Worker and Cloudflare accepted it."
              : "Add a CF_API_TOKEN secret in the Cloudflare dashboard, then verify."
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
              setDialogOpen(true);
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

      <EnableEmailApiDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accountId={accountId}
        workerScriptName={scriptName}
        workerUrl={workerUrl}
        adminToken={adminToken}
        onVerified={() => setDialogOpen(false)}
        onPasteAndPush={handlePasteServerToken}
        pasteBusy={cfBusy || serverPushBusy}
        pasteError={cfError ?? oauthError}
        pasteMessage={cfMessage}
        cfInstallTokenAvailable={cfInstallTokenAvailable}
        oauthBusy={oauthBusy}
      />
    </SettingsPageBody>
  );
}
