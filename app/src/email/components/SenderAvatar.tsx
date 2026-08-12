"use client";

import { useState } from "react";

import { senderInitials } from "@/lib/email/format-sender";
import { cn } from "@/lib/utils";

function senderDomain(fromEmail?: string): string | null {
  const email = (fromEmail ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@").pop() ?? "";
  // Skip bare localhost / IP-style hosts without a dot.
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

/**
 * Inbox/list sender avatar.
 *
 * - When the sender's email domain serves a favicon, show it.
 * - Otherwise fall back to two-letter initials (matching the thread detail).
 *   We load the favicon directly from `https://<domain>/favicon.ico` rather
 *   than a favicon-mirror service (e.g. Google s2/favicons), because those
 *   mirrors return a generic *globe* image (HTTP 200) for domains with no
 *   favicon — which would never trigger `onError`. A direct fetch 404s when
 *   the favicon is absent, so the initials fallback kicks in cleanly.
 * - Unread mail shows a small primary dot at the bottom-right corner.
 */
export function SenderAvatar({
  fromName,
  fromEmail,
  unread,
  className,
}: {
  fromName?: string | null;
  fromEmail?: string;
  unread?: boolean;
  className?: string;
}) {
  const domain = senderDomain(fromEmail);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = !!domain && !imgFailed;
  const initials = senderInitials(fromName, fromEmail);

  return (
    <span className={cn("relative flex size-7 shrink-0", className)} aria-hidden>
      <span
        className={cn(
          "flex size-7 items-center justify-center overflow-hidden rounded-full",
          showImg ? "bg-muted" : "bg-primary/15 text-primary",
        )}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://${domain}/favicon.ico`}
            alt=""
            className="size-4 object-contain"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-semibold leading-none">{initials}</span>
        )}
      </span>
      {unread ? (
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
      ) : null}
    </span>
  );
}

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
