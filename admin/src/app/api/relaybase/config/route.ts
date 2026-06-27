import { NextResponse } from "next/server";

import { ensureInboundR2Bucket, resolveInboundR2BucketName, workerInboundR2BucketMismatch } from "@/relaybase-email/lib/r2-inbound";
import {
  fetchEmailSenderHealth,
  syncWorkerRuntimeConfig,
} from "@/relaybase/lib/client";
import { runRelaybaseDiagnostics } from "@/relaybase/lib/diagnostics";
import { ensureWorkerServiceToken, resolveEmailSenderConfig } from "@/relaybase/lib/config";
import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import {
  getEmailSenderAdminSettingsDetail,
  getEmailSenderConnectionView,
  mergeEmailSenderSettings,
  readEmailSenderSettings,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

function resolveWorkerUrlForHealth(
  detail: ReturnType<typeof getEmailSenderAdminSettingsDetail>,
): string {
  return detail.workerUrl?.trim() || readRelaybaseEnvSettings().workerUrl.trim();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDiagnostics = url.searchParams.get("diagnostics") === "1";
    const detail = getEmailSenderAdminSettingsDetail();
    const workerUrl = resolveWorkerUrlForHealth(detail);
    const health = workerUrl
      ? await fetchEmailSenderHealth(workerUrl)
      : { ok: false };
    const cfg = resolveEmailSenderConfig();
    const diagnostics = includeDiagnostics
      ? await runRelaybaseDiagnostics()
      : undefined;

    if (diagnostics) {
      for (const check of diagnostics.checks) {
        if (!check.ok && check.logDetail) {
          console.error("[relaybase-diagnostics]", check.id, check.logDetail);
        }
      }
    }

    return NextResponse.json({
      ...detail,
      healthy: health.ok,
      workerUrl: workerUrl || null,
      workerLinked: Boolean(cfg),
      inboundR2WorkerReady: health.inbound?.r2Configured === true,
      inboundR2WorkerBucketName: health.inbound?.bucketName ?? null,
      inboundR2Mismatch: Boolean(
        health.inbound?.bucketName &&
          detail.inboundR2BucketName &&
          workerInboundR2BucketMismatch(
            detail.inboundR2BucketName,
            health.inbound.bucketName,
          ),
      ),
      diagnostics,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      workerUrl?: string;
      cloudflareAccountId?: string;
      cloudflareApiToken?: string;
      cloudflareZoneId?: string;
      cloudflareDnsApiToken?: string;
      inboundR2BucketName?: string;
    };
    const env = readRelaybaseEnvSettings();

    const workerUrl = env.sources.workerUrl
      ? env.workerUrl
      : body.workerUrl?.trim();
    if (!workerUrl) {
      return NextResponse.json(
        { error: "workerUrl is required" },
        { status: 400 },
      );
    }

    mergeEmailSenderSettings({
      ...(env.sources.workerUrl ? {} : { workerUrl }),
      ...(env.sources.cloudflareAccountId
        ? {}
        : { cloudflareAccountId: body.cloudflareAccountId }),
      ...(env.sources.cloudflareApiToken
        ? {}
        : { cloudflareApiToken: body.cloudflareApiToken }),
      ...(env.sources.cloudflareZoneId
        ? {}
        : { cloudflareZoneId: body.cloudflareZoneId }),
      ...(env.sources.cloudflareDnsApiToken
        ? {}
        : { cloudflareDnsApiToken: body.cloudflareDnsApiToken }),
      ...(env.sources.inboundR2BucketName
        ? {}
        : { inboundR2BucketName: body.inboundR2BucketName }),
    });

    const view = getEmailSenderConnectionView();
    if (!view.cloudflareConfigured) {
      return NextResponse.json(
        { error: "Cloudflare account ID and API token are required" },
        { status: 400 },
      );
    }

    const resolved = readEmailSenderSettings();
    const serviceToken = ensureWorkerServiceToken();

    await syncWorkerRuntimeConfig({
      baseUrl: resolved.workerUrl,
      adminToken: serviceToken,
      cloudflareAccountId: resolved.cloudflareAccountId,
      cloudflareApiToken: resolved.cloudflareApiToken,
      bootstrapToken: resolved.cloudflareApiToken,
    });

    const bucketName = resolveInboundR2BucketName(
      "relaybase",
      resolved.inboundR2BucketName,
    );
    let r2Message = "";
    try {
      const r2 = await ensureInboundR2Bucket({
        accountId: resolved.cloudflareAccountId,
        apiToken: resolved.cloudflareApiToken,
        bucketName,
      });
      if (!env.sources.inboundR2BucketName) {
        mergeEmailSenderSettings({ inboundR2BucketName: r2.bucketName });
      }
      r2Message = r2.created
        ? ` Created R2 bucket ${r2.bucketName}.`
        : ` R2 bucket ${r2.bucketName} is ready.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[relaybase-config] R2 provisioning failed", {
        bucketName,
        message,
      });
      if (/authentication error|unauthorized|9109|10000/i.test(message)) {
        r2Message =
          " R2 check failed: Cloudflare API token lacks R2 permissions. Create a token with Account → R2 → Edit, update admin/.env.local, restart admin, and sync again.";
      } else {
        throw error;
      }
    }

    const health = await fetchEmailSenderHealth(resolved.workerUrl);
    const detail = getEmailSenderAdminSettingsDetail();

    return NextResponse.json({
      ...detail,
      healthy: health.ok,
      workerUrl: resolved.workerUrl,
      workerLinked: true,
      inboundR2BucketName: bucketName,
      inboundR2WorkerReady: health.inbound?.r2Configured === true,
      inboundR2WorkerBucketName: health.inbound?.bucketName ?? null,
      message: `Settings saved and synced to worker.${r2Message}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[relaybase-config] save failed", { message, cause: error });
    return apiError(error);
  }
}
