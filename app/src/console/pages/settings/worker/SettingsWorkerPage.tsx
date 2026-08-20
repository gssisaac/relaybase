"use client";

import { Download, Loader2, Server } from "lucide-react";

import { AdminTokenPanel } from "@/console/components/setup/AdminTokenPanel";
import { WorkerVersionSettingsCard } from "@/console/components/WorkerUpdateBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKER_INSTALL_ZIP_URL, desktopOpenExternal } from "@/lib/desktop/bridge";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
  maskSecret,
} from "@/console/pages/settings/settings-shared";

export function SettingsWorkerPage() {
  const {
    credentials,
    workerStatus,
    workerHealth,
    workerUrl,
    setWorkerUrl,
    adminToken,
    setAdminToken,
    workerEditing,
    setWorkerEditing,
    workerBusy,
    workerError,
    workerMessage,
    resetWorkerDraft,
    handleSaveWorker,
  } = useSettingsConnection();

  return (
    <SettingsPageBody>
      <ConnectionCard
        icon={Server}
        title="Routing Worker"
        description="Deploy with Wrangler from the install ZIP, then paste the workers.dev URL and the same admin token you set as a secret."
        editing={workerEditing}
        onEdit={() => {
          resetWorkerDraft();
          setWorkerEditing(true);
        }}
      >
        <HealthStatus {...workerHealth} />
        {workerEditing ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">Install package</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Updates are deployed with Wrangler — the app does not upload
                  Worker code.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
              >
                <Download className="size-3.5" />
                Install ZIP
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-worker-url">Worker URL</Label>
              <Input
                id="settings-worker-url"
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://relaybase-api.<subdomain>.workers.dev"
                className="font-mono text-xs"
                autoComplete="off"
              />
            </div>

            <AdminTokenPanel
              value={adminToken}
              onChange={setAdminToken}
              cfAccountId={credentials?.accountId ?? ""}
              cfServerToken={credentials?.serverToken ?? ""}
            />

            <DesktopErrorBanner error={workerError} />
            {workerMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {workerMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  !workerUrl.trim() || !adminToken.trim() || workerBusy
                }
                onClick={() => void handleSaveWorker()}
              >
                {workerBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Verify &amp; save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={workerBusy}
                onClick={() => {
                  resetWorkerDraft();
                  setWorkerEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryRow
                label="Worker URL"
                value={
                  workerStatus?.workerUrl ||
                  credentials?.workerUrl?.trim() ||
                  "—"
                }
              />
              <SummaryRow
                label="Script"
                value={
                  workerStatus?.workerScriptName ||
                  credentials?.workerScriptName ||
                  "relaybase-api"
                }
              />
              <SummaryRow
                label="Admin token"
                value={maskSecret(credentials?.adminToken ?? "")}
              />
              <SummaryRow
                label="Version"
                value={`v${credentials?.workerVersion?.trim() || "unknown"}`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void desktopOpenExternal(WORKER_INSTALL_ZIP_URL)}
            >
              <Download className="size-3.5" />
              Install ZIP
            </Button>
            <DesktopErrorBanner error={workerError} />
          </div>
        )}
      </ConnectionCard>

      <WorkerVersionSettingsCard />
    </SettingsPageBody>
  );
}
