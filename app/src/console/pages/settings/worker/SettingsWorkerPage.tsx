"use client";

import { Loader2, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  ConnectionCard,
  HealthStatus,
  SettingsPageBody,
  SummaryRow,
} from "@/console/pages/settings/settings-shared";

export function SettingsWorkerPage() {
  const {
    credentials,
    workerStatus,
    workerHealth,
    workerUrl,
    setWorkerUrl,
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
        description="Paste the workers.dev URL. Verify uses your owner passtoken session."
        editing={workerEditing}
        onEdit={() => {
          resetWorkerDraft();
          setWorkerEditing(true);
        }}
      >
        <HealthStatus {...workerHealth} />
        {workerEditing ? (
          <>
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
                disabled={!workerUrl.trim() || workerBusy}
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
                label="Version"
                value={`v${credentials?.workerVersion?.trim() || "unknown"}`}
              />
            </div>
            <DesktopErrorBanner error={workerError} />
          </div>
        )}
      </ConnectionCard>
    </SettingsPageBody>
  );
}
