"use client";

import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api-base";

export type MobileConfigStatus = {
  enabled: boolean;
  updatedAt: string | null;
};

export type MobileConfigSetResult = {
  password: string;
  enabled: boolean;
  updatedAt: string;
};

/** Whether mobile access is enabled and when it was last set. */
export async function fetchMobileConfigStatus(): Promise<MobileConfigStatus> {
  const res = await desktopAwareFetch("/api/email/mobile-config", {
    method: "GET",
  });
  const data = await readResponseJson<MobileConfigStatus>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/** Generate (or regenerate) the mobile access password. */
export async function setMobileConfigPassword(): Promise<MobileConfigSetResult> {
  const res = await desktopAwareFetch("/api/email/mobile-config", {
    method: "POST",
  });
  const data = await readResponseJson<MobileConfigSetResult>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/** Disable mobile access entirely (clears the stored password hash). */
export async function disableMobileConfig(): Promise<MobileConfigStatus> {
  const res = await desktopAwareFetch("/api/email/mobile-config", {
    method: "DELETE",
  });
  const data = await readResponseJson<MobileConfigStatus>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/**
 * Build the deep link the Flutter app consumes to pair. The desktop Other
 * device tab QR-encodes this so the mobile app can scan and auto-fill both
 * the Worker URL and the mobile password.
 */
export function buildConnectDeepLink(params: {
  workerUrl: string;
  password: string;
}): string {
  const u = new URL("relaybase://connect");
  u.searchParams.set("workerUrl", params.workerUrl);
  u.searchParams.set("password", params.password);
  return u.toString();
}
