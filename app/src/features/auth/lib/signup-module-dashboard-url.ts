import {
  cloudflareD1DatabaseUrl,
  cloudflareR2BucketUrl,
  cloudflareWorkerServiceUrl,
} from "@/lib/desktop/bridge/cloudflare";
import type { InstallModuleId } from "@/features/auth/lib/signup-install-modules";
import { SIGNUP_R2_BUCKET, SIGNUP_WORKER_SCRIPT } from "@/features/auth/lib/signup-install-modules";

export function signupModuleDashboardUrl(
  moduleId: InstallModuleId,
  accountId: string,
  cfResourceId?: string | null,
): string | null {
  const id = accountId.trim();
  if (!id) return null;
  switch (moduleId) {
    case "r2":
      return cloudflareR2BucketUrl(id, SIGNUP_R2_BUCKET);
    case "d1-relaybase-logs":
    case "d1-relaybase-mail":
    case "d1-relaybase-db":
      return cfResourceId?.trim()
        ? cloudflareD1DatabaseUrl(id, cfResourceId.trim())
        : null;
    case "worker-setup":
      return cloudflareWorkerServiceUrl(id, SIGNUP_WORKER_SCRIPT);
    default:
      return null;
  }
}
