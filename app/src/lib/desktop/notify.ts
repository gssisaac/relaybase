"use client";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

export type NewMailNotifyItem = {
  from: string;
  subject: string;
};

let permissionRequested = false;

async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const {
      isPermissionGranted,
      requestPermission,
    } = await import("@tauri-apps/plugin-notification");
    let granted = await isPermissionGranted();
    if (!granted && !permissionRequested) {
      permissionRequested = true;
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch {
    return false;
  }
}

async function showDesktopNotification(
  title: string,
  body: string,
): Promise<void> {
  // Prefer our Rust command so macOS uses ~/.relaybase/app-icon.png
  // (plugin notifications attribute to Terminal / stale bundle icons in dev).
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_notification", { title, body });
    return;
  } catch {
    // Fall through to plugin.
  }
  const { sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  await sendNotification({ title, body });
}

/** Show a macOS notification for new inbound mail. No-op outside Tauri. */
export async function notifyNewMail(items: NewMailNotifyItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!isDesktopRuntime()) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    if (items.length === 1) {
      const item = items[0]!;
      await showDesktopNotification(
        item.from || "New email",
        item.subject?.trim() || "(no subject)",
      );
      return;
    }

    await showDesktopNotification("Relaybase", `${items.length} new messages`);
  } catch {
    // Web build or plugin unavailable.
  }
}
