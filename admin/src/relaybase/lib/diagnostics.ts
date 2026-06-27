import { ensureInboundR2Bucket, resolveInboundR2BucketName } from "@/relaybase-email/lib/r2-inbound";
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

async function verifyCloudflareToken(
  apiToken: string,
): Promise<{ ok: boolean; status: string; logDetail?: string }> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      result?: { status?: string };
      errors?: Array<{ message?: string; code?: number }>;
    };
    if (!res.ok || !data.success) {
      const message = data.errors?.[0]?.message ?? `HTTP ${res.status}`;
      return { ok: false, status: message, logDetail: message };
    }
    return { ok: true, status: data.result?.status ?? "active" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: message, logDetail: message };
  }
}

export async function runRelaybaseDiagnostics(): Promise<RelaybaseDiagnostics> {
  const env = readRelaybaseEnvSettings();
  const settings = readEmailSenderSettings();
  const workerUrl = env.workerUrl || settings.workerUrl.trim();
  const accountId = env.cloudflareAccountId || settings.cloudflareAccountId.trim();
  const apiToken = env.cloudflareApiToken || settings.cloudflareApiToken.trim();
  const bucketName = resolveInboundR2BucketName(
    "relaybase",
    env.inboundR2BucketName || settings.inboundR2BucketName,
  );
  const adminToken = resolveWorkerServiceToken();
  const checks: RelaybaseDiagnosticCheck[] = [];

  checks.push({
    id: "cloudflare-configured",
    ok: Boolean(accountId && apiToken),
    summary: accountId && apiToken
      ? "Cloudflare account ID and API token are present"
      : "Cloudflare account ID or API token is missing",
    detail:
      !accountId || !apiToken
        ? "Set RELAYBASE_CF_ACCOUNT_ID and RELAYBASE_CF_API_TOKEN in admin/.env.local (or save them in Settings)."
        : undefined,
  });

  if (apiToken) {
    const verify = await verifyCloudflareToken(apiToken);
    checks.push({
      id: "cloudflare-token-valid",
      ok: verify.ok,
      summary: verify.ok
        ? `Cloudflare API token is valid (${verify.status})`
        : "Cloudflare API token verification failed",
      detail: verify.ok
        ? undefined
        : "Update RELAYBASE_CF_API_TOKEN in admin/.env.local with a valid token.",
      logDetail: verify.logDetail,
    });
  }

  if (accountId && apiToken) {
    try {
      await ensureInboundR2Bucket({ accountId, apiToken, bucketName });
      checks.push({
        id: "r2-access",
        ok: true,
        summary: `R2 bucket "${bucketName}" is accessible`,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const authLike = /authentication error|unauthorized|9109|10000|permission/i.test(
        raw,
      );
      checks.push({
        id: "r2-access",
        ok: false,
        summary: authLike
          ? "Cloudflare API token cannot access R2"
          : "R2 bucket check failed",
        detail: authLike
          ? `Create a Cloudflare API token with Account → R2 → Edit (or Admin Read & Write), update admin/.env.local, restart admin, then sync again. Target bucket: ${bucketName}.`
          : `Could not verify bucket ${bucketName}. ${raw}`,
        logDetail: raw,
      });
    }
  }

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
      const mismatch =
        health.inbound.bucketName.toLowerCase() !== bucketName.toLowerCase();
      checks.push({
        id: "r2-bucket-match",
        ok: !mismatch,
        summary: mismatch
          ? `Worker inbound bucket mismatch (worker: ${health.inbound.bucketName}, expected: ${bucketName})`
          : `Worker inbound bucket matches (${bucketName})`,
        detail: mismatch
          ? `Redeploy the worker after updating wrangler.toml INBOUND_BUCKET_NAME and the R2 binding, or set RELAYBASE_INBOUND_R2_BUCKET=${health.inbound.bucketName} in admin/.env.local to match the deployed worker.`
          : undefined,
      });
    }

    if (adminToken) {
      const workerAuth = await verifyRelaybaseWorkerAdminToken(workerUrl, adminToken);
      checks.push({
        id: "worker-admin-token",
        ok: workerAuth,
        summary: workerAuth
          ? "Worker accepts the stored admin service token"
          : "Worker rejected the stored admin service token",
        detail: workerAuth
          ? undefined
          : 'Click "Sync to worker" to bootstrap. Bootstrap auth must match the worker secret CF_API_TOKEN (wrangler secret put CF_API_TOKEN) or ADMIN_TOKEN.',
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
