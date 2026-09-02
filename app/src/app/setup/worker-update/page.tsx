"use client";

import { WorkerInstallPanel } from "@/console/components/setup/WorkerInstallPanel";

/** Logged-out Worker update (forgot-passtoken recover cannot reach Settings). */
export default function SetupWorkerUpdatePage() {
  return (
    <WorkerInstallPanel
      purpose="worker-update"
      backHref="/setup/recover-admin"
    />
  );
}
