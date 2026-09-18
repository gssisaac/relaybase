"use client";

import dynamic from "next/dynamic";

import { WebSetupInstallProgressPage } from "@/console/components/setup/WebSetupInstallProgressPage";
import { useWebSetupInstall } from "@/console/components/setup/use-web-setup-install";

const DesktopSetupProgressPanel = dynamic(
  () =>
    import("@/console/components/setup/DesktopSetupProgressPanel").then(
      (m) => m.DesktopSetupProgressPanel,
    ),
  { ssr: false },
);

export default function SetupProgressPage() {
  const webSetupInstall = useWebSetupInstall();
  if (webSetupInstall) {
    return <WebSetupInstallProgressPage />;
  }
  return <DesktopSetupProgressPanel />;
}
