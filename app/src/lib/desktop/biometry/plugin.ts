"use client";

import {
  desktopOwnerTouchId,
  invoke,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

import type { BiometryStatus, BiometryType } from "./types";

/**
 * Touch ID (macOS) / Windows Hello.
 *
 * Daily unlock goes through `owner_touch_id_cmd` (main-thread LAContext) via
 * the same `__TAURI_INTERNALS__` invoke as every other desktop command.
 * Do not dynamically import `@tauri-apps/api/core` here — Next/Tauri can
 * fail or hang loading that chunk, which left UnlockView busy and silent.
 *
 * Production Mac builds must be Developer ID signed or LocalAuthentication /
 * keychain calls fail. Plugin `status` is label-only.
 */

type PluginStatus = {
  isAvailable?: boolean;
  biometryType?: number;
  error?: string;
  errorCode?: string;
};

export async function desktopCheckBiometry(): Promise<BiometryStatus> {
  if (!isDesktopRuntime()) {
    return { isAvailable: false, biometryType: 0, errorCode: "notSupported" };
  }
  try {
    const status = await invoke<PluginStatus>("plugin:biometry|status");
    return {
      isAvailable: Boolean(status.isAvailable),
      biometryType: (status.biometryType ?? 0) as BiometryType,
      error: status.error,
      errorCode: status.errorCode,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isAvailable: false,
      biometryType: 0,
      error: message,
      errorCode: "notSupported",
    };
  }
}

/** Prompt Touch ID / Windows Hello, with device PIN/password fallback. */
export async function desktopAuthenticateBiometry(
  reason = "Unlock Relaybase",
): Promise<void> {
  await desktopOwnerTouchId(reason);
}
