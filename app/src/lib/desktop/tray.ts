import { invoke, isDesktopRuntime } from "@/lib/desktop/bridge";

/** Push unread badge state to the desktop system tray icon. */
export async function setTrayUnread(hasUnread: boolean): Promise<void> {
  if (!isDesktopRuntime()) return;
  try {
    await invoke("set_tray_unread", { hasUnread });
  } catch {
    // Tray may not be ready yet (e.g. early boot); ignore.
  }
}
