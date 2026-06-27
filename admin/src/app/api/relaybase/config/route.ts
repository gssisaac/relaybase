import { NextResponse } from "next/server";

import { ensureInboundR2Bucket, resolveInboundR2BucketName } from "@/relaybase-email/lib/r2-inbound";
import {
  fetchEmailSenderHealth,
  syncWorkerRuntimeConfig,
} from "@/relaybase/lib/client";
import { ensureWorkerServiceToken, resolveEmailSenderConfig } from "@/relaybase/lib/config";
import {
  getEmailSenderAdminSettingsDetail,
  getEmailSenderConnectionView,
  mergeEmailSenderSettings,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

export async function GET() {
  try {
    const detail = getEmailSenderAdminSettingsDetail();
    const cfg = resolveEmailSenderConfig();
    const health = cfg ? await fetchEmailSenderHealth(cfg.baseUrl) : { ok: false };

    return NextResponse.json({
      ...detail,
      healthy: health.ok,
      workerUrl: cfg?.baseUrl ?? detail.workerUrl ?? null,
      inboundR2WorkerReady: health.inbound?.r2Configured === true,
      inboundR2WorkerBucketName: health.inbound?.bucketName ?? null,
      inboundR2Mismatch: Boolean(
        health.inbound?.bucketName &&
          detail.inboundR2BucketName &&
          health.inbound.bucketName.toLowerCase() !==
            detail.inboundR2BucketName.toLowerCase(),
      ),
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
    const workerUrl = body.workerUrl?.trim();
    if (!workerUrl) {
      return NextResponse.json(
        { error: "workerUrl is required" },
        { status: 400 },
      );
    }

    const settings = mergeEmailSenderSettings({
      workerUrl,
      cloudflareAccountId: body.cloudflareAccountId,
      cloudflareApiToken: body.cloudflareApiToken,
      cloudflareZoneId: body.cloudflareZoneId,
      cloudflareDnsApiToken: body.cloudflareDnsApiToken,
      inboundR2BucketName: body.inboundR2BucketName,
    });

    const view = getEmailSenderConnectionView();
    if (!view.cloudflareConfigured) {
      return NextResponse.json(
        { error: "Cloudflare account ID and API token are required" },
        { status: 400 },
      );
    }

    const bucketName = resolveInboundR2BucketName(
      "relaybase",
      settings.inboundR2BucketName,
    );
    const r2 = await ensureInboundR2Bucket({
      accountId: settings.cloudflareAccountId,
      apiToken: settings.cloudflareApiToken,
      bucketName,
    });
    mergeEmailSenderSettings({ inboundR2BucketName: r2.bucketName });

    const serviceToken = ensureWorkerServiceToken();

    await syncWorkerRuntimeConfig({
      baseUrl: settings.workerUrl,
      adminToken: serviceToken,
      cloudflareAccountId: settings.cloudflareAccountId,
      cloudflareApiToken: settings.cloudflareApiToken,
      bootstrapToken: settings.cloudflareApiToken,
    });

    const health = await fetchEmailSenderHealth(settings.workerUrl);
    const detail = getEmailSenderAdminSettingsDetail();
    const r2Message = r2.created
      ? ` Created R2 bucket ${r2.bucketName}.`
      : ` R2 bucket ${r2.bucketName} is ready.`;

    return NextResponse.json({
      ...detail,
      healthy: health.ok,
      workerUrl: settings.workerUrl,
      inboundR2BucketName: r2.bucketName,
      inboundR2WorkerReady: health.inbound?.r2Configured === true,
      inboundR2WorkerBucketName: health.inbound?.bucketName ?? null,
      message: `Settings saved and synced to worker.${r2Message}`,
    });
  } catch (error) {
    return apiError(error);
  }
}
