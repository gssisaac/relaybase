"use client";

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

/** Show a macOS notification for new inbound mail. No-op outside Tauri. */
export async function notifyNewMail(items: NewMailNotifyItem[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const { sendNotification } = await import(
      "@tauri-apps/plugin-notification"
    );

    if (items.length === 1) {
      const item = items[0]!;
      await sendNotification({
        title: item.from || "New email",
        body: item.subject?.trim() || "(no subject)",
      });
      return;
    }

    await sendNotification({
      title: "Relaybase",
      body: `${items.length} new messages`,
    });
  } catch {
    // Web build or plugin unavailable.
  }
}
