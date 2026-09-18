"use client";

import { WebInstallProgress } from "@/console/components/setup/WebInstallFlow";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";

/** Browser install progress — SSE from `/api/install/stream` (OAuth in sealed cookie). */
export function WebSetupInstallProgressPage() {
  return (
    <SetupScrollPage>
      <div className="mt-3 space-y-4">
        <div className="flex justify-end">
          <SetupBackLink href="/setup/install" label="Back" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Installing</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Creating resources and deploying the Worker in your Cloudflare account.
          </p>
        </div>
        <WebInstallProgress />
      </div>
    </SetupScrollPage>
  );
}
