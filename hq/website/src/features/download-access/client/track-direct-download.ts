"use client";

import type { MacArch } from "../shared/types";
import { getOrCreateClientId, resolveDirectDownloadApiUrl } from "./client-id";

function readTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function isCrossOriginApiUrl(apiUrl: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(apiUrl).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function postTrackPayload(body: {
  clientId: string;
  timezone?: string;
  arch?: MacArch;
}): void {
  const payload = JSON.stringify(body);
  const apiUrl = resolveDirectDownloadApiUrl();
  const crossOrigin = isCrossOriginApiUrl(apiUrl);

  // sendBeacon cannot complete CORS preflight — JSON POST from localhost dev fails silently.
  if (!crossOrigin && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(apiUrl, blob)) {
      return;
    }
  }

  void fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "omit",
    mode: "cors",
  }).catch(() => {});
}

/** Fire-and-forget — does not block the DMG download. */
export function trackDirectDownloadAsync(opts?: { arch?: MacArch }): void {
  if (typeof window === "undefined") return;

  const clientId = getOrCreateClientId();
  if (!clientId) return;

  postTrackPayload({
    clientId,
    timezone: readTimezone(),
    arch: opts?.arch ?? "aarch64",
  });
}
