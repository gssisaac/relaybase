"use client";

import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api";

export type AccountMobileStatus = {
  hasPassword: boolean;
  updatedAt: string | null;
};

export type AccountMobilePasswordResult = {
  password: string;
  hasPassword: boolean;
  updatedAt: string;
};

/** Whether a per-account mobile password is set. */
export async function fetchAccountMobileStatus(
  email: string,
): Promise<AccountMobileStatus> {
  const res = await desktopAwareFetch(
    `/api/email/mobile-password?email=${encodeURIComponent(email)}`,
    { method: "GET" },
  );
  const data = await readResponseJson<AccountMobileStatus>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/** Generate (or regenerate) the per-account mobile password. Returns the plain password once. */
export async function setAccountMobilePassword(
  email: string,
): Promise<AccountMobilePasswordResult> {
  const res = await desktopAwareFetch("/api/email/mobile-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await readResponseJson<AccountMobilePasswordResult>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/** Clear the per-account mobile password (disables mobile login for this account). */
export async function clearAccountMobilePassword(
  email: string,
): Promise<AccountMobileStatus> {
  const res = await desktopAwareFetch(
    `/api/email/mobile-password?email=${encodeURIComponent(email)}`,
    { method: "DELETE" },
  );
  const data = await readResponseJson<AccountMobileStatus>(res);
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Worker error ${res.status}`,
    );
  }
  return data;
}

/**
 * Build the deep link the Flutter app consumes to pair. The desktop Other
 * device tab QR-encodes this so the mobile app can scan and auto-fill the
 * Worker URL, account email, and per-account password.
 */
export function buildConnectDeepLink(params: {
  workerUrl: string;
  email: string;
  password: string;
}): string {
  const u = new URL("relaybase://connect");
  u.searchParams.set("workerUrl", params.workerUrl);
  u.searchParams.set("email", params.email);
  u.searchParams.set("password", params.password);
  return u.toString();
}
