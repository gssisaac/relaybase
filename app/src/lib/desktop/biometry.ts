"use client";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

/**
 * Touch ID (macOS) / Windows Hello via tauri-plugin-biometry.
 *
 * Invokes the plugin commands through `@tauri-apps/api` so the dashboard
 * shell can compile without resolving the plugin's JS package (Turbopack
 * treats `import("…-biometry-api")` as a hard compile error).
 *
 * Production Mac builds must be Developer ID signed or LocalAuthentication /
 * keychain calls fail. `tauri dev` unsigned builds typically report
 * unavailable and the unlock UI falls back to username + passtoken.
 *
 * allowDeviceCredential: if biometry fails, the OS offers the device PIN /
 * password. Both failing → passtoken re-entry.
 */

export type BiometryType = 0 | 1 | 2 | 3 | 4;
// Plugin enum: 0 None, 1 Auto (Windows Hello), 2 TouchID, 3 FaceID, 4 Iris

export type BiometryStatus = {
  isAvailable: boolean;
  biometryType: BiometryType;
  error?: string;
  errorCode?: string;
};

type PluginStatus = {
  isAvailable?: boolean;
  biometryType?: number;
  error?: string;
  errorCode?: string;
};

export function biometryLabel(type: BiometryType, platform?: string): string {
  if (type === 2) return "Touch ID";
  if (type === 3) return "Face ID";
  if (type === 4) return "Iris";
  if (type === 1 || platform === "windows") return "Windows Hello";
  if (platform === "macos") return "Touch ID";
  return "device password";
}

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
  await invoke("plugin:biometry|authenticate", {
    reason,
    options: {
      allowDeviceCredential: true,
      cancelTitle: "Cancel",
      fallbackTitle: "Use device password",
      title: "Unlock Relaybase",
      subtitle: reason,
      confirmationRequired: false,
    },
  });
}
