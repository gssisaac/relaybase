/**
 * Web platform — no-op / Web-standard implementations of OS integrations.
 *
 * Email mode (web-only) has no system tray, no native notifications
 * (uses Web Notifications API if granted), and opens attachments as
 * download links instead of OS-default apps.
 */
import type { MailPlatform, NewMailNotifyItem } from "../types";

export function createWebPlatform(): MailPlatform {
  return {
    async notifyNewMail(items: NewMailNotifyItem[]): Promise<void> {
      if (items.length === 0) return;
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      try {
        if (Notification.permission === "granted") {
          // pass
        } else if (Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return;
        if (items.length === 1) {
          const item = items[0]!;
          new Notification(item.from || "New email", {
            body: item.subject?.trim() || "(no subject)",
          });
        } else {
          new Notification("Relaybase", {
            body: `${items.length} new messages`,
          });
        }
      } catch {
        // Web Notifications unavailable — ignore.
      }
    },

    async setTrayUnread(_hasUnread: boolean): Promise<void> {
      void _hasUnread;
      // No system tray on web.
    },

    async openExternal(url: string): Promise<void> {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },

    async openAttachment(filename: string, _data: Uint8Array): Promise<void> {
      void filename;
      void _data;
      // Web: handled as a download link in the UI, not an OS opener.
      // This is a no-op; the attachment component creates a blob URL.
    },
  };
}
