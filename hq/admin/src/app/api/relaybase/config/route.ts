import { NextResponse } from "next/server";

import { fetchEmailSenderHealth } from "@/relaybase/lib/client";
import { runRelaybaseDiagnostics } from "@/relaybase/lib/diagnostics";
import { resolveEmailSenderConfig } from "@/relaybase/lib/config";
import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import {
  getEmailSenderAdminSettingsDetail,
  getEmailSenderConnectionView,
  mergeEmailSenderSettings,
  type EmailSenderAdminConfigDetail,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

function resolveWorkerUrlForHealth(
  detail: EmailSenderAdminConfigDetail,
): string {
  return detail.workerUrl?.trim() || readRelaybaseEnvSettings().workerUrl.trim();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDiagnostics = url.searchParams.get("diagnostics") === "1";
    const detail = await getEmailSenderAdminSettingsDetail();
    const workerUrl = resolveWorkerUrlForHealth(detail);
    const health = workerUrl
      ? await fetchEmailSenderHealth(workerUrl)
      : { ok: false };
    const cfg = await resolveEmailSenderConfig();
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

    await mergeEmailSenderSettings({
      ...(env.sources.workerUrl ? {} : { workerUrl }),
    });

    const resolved = await resolveEmailSenderConfig();
    const health = resolved
      ? await fetchEmailSenderHealth(resolved.baseUrl)
      : { ok: false };
    const detail = await getEmailSenderAdminSettingsDetail();

    return NextResponse.json({
      ...detail,
      healthy: health.ok,
      workerUrl: resolved?.baseUrl ?? workerUrl,
      workerLinked: Boolean(resolved),
      message: "Settings saved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[relaybase-config] save failed", { message, cause: error });
    return apiError(error);
  }
}
