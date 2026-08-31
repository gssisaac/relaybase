import {
  INBOUND_R2_BUCKET_NAME,
  isLegacyInboundR2BucketName,
  workerInboundR2BucketMismatch,
} from "@/relaybase-email/lib/r2-inbound";
import {
  fetchEmailSenderHealth,
  verifyRelaybaseWorkerAdminToken,
} from "@/relaybase/lib/client";
import { resolveWorkerServiceToken } from "@/relaybase/lib/config";
import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import { readEmailSenderSettings } from "@/relaybase/lib/settings";

export type RelaybaseDiagnosticCheck = {
  id: string;
  ok: boolean;
  summary: string;
  detail?: string;
  logDetail?: string;
};

export type RelaybaseDiagnostics = {
  checkedAt: string;
  checks: RelaybaseDiagnosticCheck[];
};

export async function runRelaybaseDiagnostics(): Promise<RelaybaseDiagnostics> {
  const env = readRelaybaseEnvSettings();
  const settings = await readEmailSenderSettings();
  const workerUrl = env.workerUrl || settings.workerUrl.trim();
  const adminToken = await resolveWorkerServiceToken();
  const expectedBucket = INBOUND_R2_BUCKET_NAME;
  const checks: RelaybaseDiagnosticCheck[] = [];

  if (workerUrl) {
    const health = await fetchEmailSenderHealth(workerUrl);
    checks.push({
      id: "worker-health",
      ok: health.ok,
      summary: health.ok ? "Worker /health responded OK" : "Worker /health failed",
      detail: health.ok
        ? undefined
        : `Check RELAYBASE_URL (${workerUrl}) and that the worker is deployed.`,
    });

    if (health.inbound?.bucketName) {
      const mismatch = workerInboundR2BucketMismatch(
        expectedBucket,
        health.inbound.bucketName,
      );
      const legacyWorkerName = isLegacyInboundR2BucketName(
        health.inbound.bucketName,
      );
      checks.push({
        id: "r2-bucket-match",
        ok: !mismatch,
        summary: mismatch
          ? legacyWorkerName
            ? `Worker still bound to legacy bucket "${health.inbound.bucketName}" — redeploy with relaybase-mailbox`
            : `Worker inbound bucket mismatch (worker: ${health.inbound.bucketName}, expected: ${expectedBucket})`
          : `Worker inbound bucket matches (${expectedBucket})`,
        detail: mismatch
          ? `Redeploy the worker: server/wrangler.toml must set bucket_name and INBOUND_BUCKET_NAME to ${expectedBucket}, then run npm run deploy --prefix server.`
          : undefined,
      });
    }

    if (adminToken) {
      const workerAuth = await verifyRelaybaseWorkerAdminToken(workerUrl, adminToken);
      checks.push({
        id: "worker-admin-token",
        ok: workerAuth,
        summary: workerAuth
          ? "Worker accepts the stored admin token"
          : "Worker rejected the stored admin token",
        detail: workerAuth
          ? undefined
          : "The admin token in Settings must match the worker's ADMIN_TOKEN wrangler secret (set via the desktop install flow). Re-save Settings with the matching token.",
        logDetail: workerAuth ? undefined : `admin token prefix: ${adminToken.slice(0, 12)}…`,
      });
    }
  } else {
    checks.push({
      id: "worker-url",
      ok: false,
      summary: "Worker URL is not configured",
      detail: "Set RELAYBASE_URL in admin/.env.local.",
    });
  }

  return { checkedAt: new Date().toISOString(), checks };
}
