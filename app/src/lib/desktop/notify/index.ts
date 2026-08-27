"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { inboxHrefForNotification } from "./open-mail";

export type NewMailNotifyItem = {
  from: string;
  subject: string;
  messageId: string;
  account?: string | null;
};

export type OpenMailPayload = {
  messageId: string;
  account?: string | null;
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
  messageId?: string | null,
  account?: string | null,
): Promise<void> {
  // Prefer our Rust command so macOS uses ~/.relaybase/app-icon.png
  // (plugin notifications attribute to Terminal / stale bundle icons in dev).
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_notification", {
      title,
      body,
      messageId: messageId ?? null,
      account: account ?? null,
    });
    return;
  } catch {
    // Fall through to plugin.
  }
  const { sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  await sendNotification({
    title,
    body,
    extra: {
      messageId: messageId ?? "",
      account: account ?? "",
    },
  });
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
        item.messageId,
        item.account,
      );
      return;
    }

    const newest = items[0]!;
    await showDesktopNotification(
      "Relaybase",
      `${items.length} new messages`,
      newest.messageId,
      newest.account,
    );
  } catch {
    // Web build or plugin unavailable.
  }
}

function openMailFromPayload(
  router: { push: (href: string) => void },
  payload: { messageId?: string | null; account?: string | null },
) {
  const href = inboxHrefForNotification(payload);
  if (href) router.push(href);
}

function extraFromUnknown(
  extra: unknown,
): { messageId?: string; account?: string } | null {
  if (!extra || typeof extra !== "object") return null;
  const record = extra as Record<string, unknown>;
  const messageId =
    typeof record.messageId === "string" ? record.messageId : undefined;
  const account =
    typeof record.account === "string" ? record.account : undefined;
  if (!messageId) return null;
  return { messageId, account };
}

/**
 * Desktop: open the inbox message when a new-mail notification is clicked.
 * Mount once in EmailShell so it is alive on mailbox and dashboard routes.
 */
export function useNotificationOpenMail() {
  const router = useRouter();

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let cancelled = false;
    let unlistenEvent: (() => void) | undefined;
    let unlistenAction: (() => void) | undefined;

    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const { invoke } = await import("@tauri-apps/api/core");
        if (cancelled) return;
        unlistenEvent = await listen<OpenMailPayload>(
          "notification-open-mail",
          (event) => {
            openMailFromPayload(router, event.payload);
          },
        );
        try {
          const pending = await invoke<OpenMailPayload | null>(
            "take_pending_open_mail",
          );
          if (pending && !cancelled) openMailFromPayload(router, pending);
        } catch {
          // Command missing on older desktop builds.
        }
      } catch {
        // Tauri event API unavailable.
      }

      try {
        const { onAction } = await import("@tauri-apps/plugin-notification");
        const actionListener = await onAction((notification) => {
          const extra = extraFromUnknown(notification.extra);
          if (extra) openMailFromPayload(router, extra);
        });
        unlistenAction = () => {
          void actionListener.unregister();
        };
      } catch {
        // Plugin action listener unavailable.
      }
    })();

    return () => {
      cancelled = true;
      unlistenEvent?.();
      unlistenAction?.();
    };
  }, [router]);
}
