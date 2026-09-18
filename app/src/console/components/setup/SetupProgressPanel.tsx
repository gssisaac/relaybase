"use client";

import { SetupProgressPanelCore } from "@/console/components/setup/common/install/SetupProgressPanelCore";
import type { InstallFlowPurpose } from "@/console/lib/install-flow";

/** Unified Cloudflare install / Worker update progress (web + desktop). */
export function SetupProgressPanel({
  purpose = "install",
  fromRecover = false,
}: {
  purpose?: InstallFlowPurpose;
  fromRecover?: boolean;
}) {
  return <SetupProgressPanelCore purpose={purpose} fromRecover={fromRecover} />;
}
