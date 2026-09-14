import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";

/** Forgot-passtoken recovery (Cloudflare OAuth + `/console/reset-admin`). */
export const RECOVER_ADMIN_PATH = "/recover-admin";

export function recoverAdminHref(workerUrl?: string): string {
  const normalized = normalizeWorkerUrl(workerUrl ?? "");
  if (!normalized) return RECOVER_ADMIN_PATH;
  return `${RECOVER_ADMIN_PATH}?workerUrl=${encodeURIComponent(normalized)}`;
}
