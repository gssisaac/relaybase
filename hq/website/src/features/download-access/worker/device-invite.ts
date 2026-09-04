import { DEVICE_EMAIL_PREFIX } from "../shared/constants";
import type { TrackDirectDownloadBody } from "../shared/types";
import {
  appendDownload,
  getInviteByEmail,
  insertInvite,
  patchInviteClientIfUnknown,
} from "@/worker/invites";
import type { IncomingCf, InviteData, WorkerEnv } from "@/worker/types";
import { parseUserAgent } from "@/worker/ua";

export function deviceKeyFromClientId(clientId: string): string {
  return `${DEVICE_EMAIL_PREFIX}${clientId}`;
}

export async function trackDirectDeviceDownload(
  request: Request,
  env: WorkerEnv,
  body: TrackDirectDownloadBody,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!env.DB) {
    return { ok: false, status: 503, error: "Download tracking is not configured" };
  }

  const deviceKey = deviceKeyFromClientId(body.clientId);
  const existing = await getInviteByEmail(env, deviceKey);
  const rowUuid = existing?.uuid ?? crypto.randomUUID();
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? "";
  const { browser, os } = parseUserAgent(userAgent);

  if (!existing) {
    const cf = (request as Request & { cf?: IncomingCf }).cf;
    const data: InviteData = {
      email: deviceKey,
      source: "direct",
      createdAt: new Date().toISOString(),
      locale: {
        country: cf?.country,
        city: cf?.city,
        region: cf?.region,
        timezone: body.timezone ?? cf?.timezone,
      },
      browser,
      os,
      userAgent,
      downloads: [],
    };
    try {
      await insertInvite(env, rowUuid, data);
    } catch (error) {
      console.error("direct download invite insert failed", error);
      return { ok: false, status: 500, error: "Failed to record download" };
    }
  } else if (userAgent) {
    await patchInviteClientIfUnknown(env, rowUuid, {
      userAgent,
      browser,
      os,
    });
  }

  await appendDownload(env, rowUuid, new Date().toISOString());
  return { ok: true };
}
