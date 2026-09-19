import {
  cloudflareD1DashboardUrl,
  cloudflareR2BucketUrl,
  cloudflareWorkerServiceUrl,
  cloudflareWorkerSettingsUrl,
} from "@/lib/desktop/bridge/cloudflare";
import type { InstallModuleId } from "@/lib/desktop/bridge/web-install-stream";

const R2_BUCKET = "relaybase-mailbox";
const WORKER_SCRIPT = "relaybase-api";

export function signupModuleDashboardUrl(
  moduleId: InstallModuleId,
  accountId: string,
): string | null {
  const id = accountId.trim();
  if (!id) return null;
  switch (moduleId) {
    case "r2":
      return cloudflareR2BucketUrl(id, R2_BUCKET);
    case "d1":
    case "schema":
      return cloudflareD1DashboardUrl(id);
    case "worker":
      return cloudflareWorkerServiceUrl(id, WORKER_SCRIPT);
    case "secrets":
      return cloudflareWorkerSettingsUrl(id, WORKER_SCRIPT);
    default:
      return null;
  }
}
