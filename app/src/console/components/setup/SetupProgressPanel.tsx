"use client";

import { DesktopSetupProgressPanel } from "@/console/components/setup/DesktopSetupProgressPanel";
import { WebSetupInstallProgressPage } from "@/console/components/setup/WebSetupInstallProgressPage";
import { WorkerUpdateProgressView } from "@/console/components/setup/WorkerUpdateProgressView";
import { useWebSetupInstall } from "@/console/components/setup/use-web-setup-install";
import type { InstallFlowPurpose } from "@/console/lib/install-flow";

/**
 * Install / update progress — web and desktop are separate implementations so
 * web never runs desktop keyring OAuth checks (which would bounce back to install).
 */
export function SetupProgressPanel({
  purpose = "install",
  fromRecover = false,
}: {
  purpose?: InstallFlowPurpose;
  fromRecover?: boolean;
}) {
  const webSetupInstall = useWebSetupInstall();
  if (webSetupInstall) {
    if (purpose === "install") {
      return <WebSetupInstallProgressPage />;
    }
    return (
      <WorkerUpdateProgressView
        backHref={fromRecover ? "/recover-admin" : undefined}
        backLabel={fromRecover ? "Back" : undefined}
      />
    );
  }
  return (
    <DesktopSetupProgressPanel purpose={purpose} fromRecover={fromRecover} />
  );
}
