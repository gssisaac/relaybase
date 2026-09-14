"use client";

import { memo, useEffect } from "react";
import { observer } from "mobx-react-lite";

import { useSenderIconStore } from "@/email/components/sender/SenderIconContext";
import { senderIconDomain } from "@/email/stores/sender-icon-store";
import { senderInitials } from "@/lib/email/format-sender";
import { cn } from "@/lib/utils";

/**
 * Inbox/list sender avatar.
 *
 * - When the sender's email domain serves a favicon, show it.
 * - Otherwise fall back to two-letter initials (matching the thread detail).
 * - Favicons are loaded once per domain through the Worker favicon proxy and
 *   kept resident in `SenderIconStore` as data URLs, so virtualized rows
 *   re-mounting never re-fetch (see `app/src/email/stores/sender-icon-store.ts`).
 * - Unread mail shows a small primary dot at the bottom-right corner.
 */
export const SenderAvatar = memo(
  observer(function SenderAvatar({
    fromName,
    fromEmail,
    unread,
    className,
    size = "sm",
  }: {
    fromName?: string | null;
    fromEmail?: string;
    unread?: boolean;
    className?: string;
    /** `sm` = 28px (desktop table rows), `lg` = 40px (mobile list rows). */
    size?: "sm" | "lg";
  }) {
    const store = useSenderIconStore();
    const domain = senderIconDomain(fromEmail);

    useEffect(() => {
      if (domain) store.load(domain);
    }, [store, domain]);

    const entry = domain ? store.getIcon(domain) : undefined;
    const dataUrl = entry?.status === "ready" ? entry.dataUrl : null;
    const initials = senderInitials(fromName, fromEmail);
    const large = size === "lg";

    return (
      <span
        className={cn(
          "relative flex shrink-0",
          large ? "size-10" : "size-7",
          className,
        )}
        aria-hidden
      >
        <span
          className={cn(
            "flex size-full items-center justify-center overflow-hidden rounded-full",
            dataUrl ? "bg-muted" : "bg-primary/15 text-primary",
          )}
        >
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt=""
              className={cn("object-contain", large ? "size-5" : "size-4")}
            />
          ) : (
            <span
              className={cn(
                "font-semibold leading-none",
                large ? "text-sm" : "text-[11px]",
              )}
            >
              {initials}
            </span>
          )}
        </span>
        {unread ? (
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </span>
    );
  }),
);

/**
 * Pull the first email address out of a "Name <a@b.com>" / "a@b.com" /
 * comma-separated recipient string (used by Sent / Drafts rows).
 */
export function extractFirstEmail(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const angle = s.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1];
  const bare = s.match(/([^\s,]+@[^\s,]+)/);
  return bare?.[1];
}
