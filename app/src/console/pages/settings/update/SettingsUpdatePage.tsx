"use client";

import { Download } from "lucide-react";

import { DesktopAppVersionSettingsCard } from "@/console/components/AppUpdateBanner";
import { WorkerVersionSettingsCard } from "@/console/components/WorkerUpdateBanner";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { SettingsPageBody } from "@/console/pages/settings/settings-shared";

export function SettingsUpdatePage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar className="px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Update
          </h1>
          <p className="text-sm text-muted-foreground">
            Desktop app and routing Worker stay on the same version. Update the
            desktop app first, then match the Worker.
          </p>
        </div>
      </DesktopTitleBar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsPageBody>
          <DesktopAppVersionSettingsCard />
          <WorkerVersionSettingsCard />
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Download className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Relaybase ships desktop and Worker releases together. The Worker
            cannot run ahead of the desktop app version installed on this Mac.
          </p>
        </SettingsPageBody>
      </div>
    </div>
  );
}
