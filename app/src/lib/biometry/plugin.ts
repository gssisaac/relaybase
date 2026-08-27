"use client";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

import type { BiometryStatus, BiometryType } from "./types";

/**
 * Touch ID (macOS) / Windows Hello via tauri-plugin-biometry.
 *
 * Invokes the plugin commands through `@tauri-apps/api` so the dashboard
 * shell can compile without resolving the plugin's JS package (Turbopack
 * treats `import("…-biometry-api")` as a hard compile error).
 *
 * Production Mac builds must be Developer ID signed or LocalAuthentication /
 * keychain calls fail. Plugin `status` is label-only — daily unlock prompts
 * via `owner_touch_id_cmd` whenever a keyring refresh exists.
 *
 * allowDeviceCredential: if biometry fails, the OS offers the device PIN /
 * password. Both failing → passtoken re-entry.
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
    const { invoke } = await import("@tauri-apps/api/core");
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
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("owner_touch_id_cmd", { reason });
}
