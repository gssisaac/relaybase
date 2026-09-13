/**
 * Desktop platform — delegates to the existing Tauri bridge for OS
 * notifications, tray, and file opening.
 */
import { notifyNewMail as desktopNotifyNewMail } from "@/lib/desktop/notify";
import { setTrayUnread as desktopSetTrayUnread } from "@/lib/desktop/tray";
import { desktopOpenExternal, desktopOpenAttachment } from "@/lib/desktop/bridge";
import type { MailPlatform } from "../types";

export function createDesktopPlatform(): MailPlatform {
  return {
    async notifyNewMail(items) {
      await desktopNotifyNewMail(items);
    },
    async setTrayUnread(hasUnread) {
      await desktopSetTrayUnread(hasUnread);
    },
    async openExternal(url) {
      await desktopOpenExternal(url);
    },
    async openAttachment(filename, data) {
      await desktopOpenAttachment(filename, data);
    },
  };
}
