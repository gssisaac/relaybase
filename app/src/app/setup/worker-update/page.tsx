"use client";

import { WorkerInstallPanel } from "@/console/components/setup/common/install/WorkerInstallPanel";

/** Logged-out Worker update (forgot-passtoken recover cannot reach Settings). */
export default function SetupWorkerUpdatePage() {
  return (
    <WorkerInstallPanel
      purpose="worker-update"
      backHref="/recover-admin"
    />
  );
}
