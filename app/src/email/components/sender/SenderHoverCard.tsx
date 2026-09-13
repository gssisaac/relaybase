"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { SenderAvatar } from "@/email/components/sender/SenderAvatar";
import {
  formatFullAddress,
  formatSenderDisplay,
  senderInitials,
  splitRecipients,
} from "@/lib/email/format-sender";
import { cn } from "@/lib/utils";

/**
 * Gmail-style hover card for a sender / recipient.
 *
 * Wraps a trigger (defaults to a `SenderAvatar`) and opens a small card on
 * hover with the display name, email address, and a copy-email button. The
 * card content is rendered in a portal, so copy buttons work even when the
 * trigger sits inside a list-row `<Link>` (clicking copy does not navigate).
 *
 * Uses Base UI's `PreviewCard` rather than `Popover` so the trigger renders
 * as a plain `<span>` — no `role="button"` or forced `tabindex` — which keeps
 * it valid as a non-interactive element inside the list row's `<a>`. The
 * card is controlled: hover opens it (via Base UI's hover interaction) and
 * clicking the trigger also opens it while `stopPropagation` prevents the
 * click from reaching the list-row `<Link>` (so the message behind doesn't
 * toggle).
 *
 * For Sent / Drafts rows the "sender" displayed is the first recipient — pass
 * that recipient's email as `fromEmail` and the card shows their info.
 */
export function SenderHoverCard({
  fromName,
  fromEmail,
  children,
  className,
  triggerClassName,
  side = "bottom",
  align = "center",
}: {
  fromName?: string | null;
  fromEmail?: string;
  /** Trigger element. Defaults to `<SenderAvatar>`. */
  children?: React.ReactNode;
  /** Class on the card content. */
  className?: string;
  /** Class on the trigger wrapper. */
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { name, email, fullAddress } = useMemo(() => {
    let n = (fromName ?? "").trim().replace(/^["']|["']$/g, "");
    let e = (fromEmail ?? "").trim();

    if (!n && e) {
      const parts = splitRecipients(e);
      if (parts.length > 0 && parts[0]?.email) {
        if (parts[0].name) n = parts[0].name.trim().replace(/^["']|["']$/g, "");
        e = parts[0].email.trim();
      }
    }

    const full = formatFullAddress(n, e);
    return { name: n, email: e, fullAddress: full };
  }, [fromName, fromEmail]);

  const displayName = formatSenderDisplay(name, email);
  const hasName = Boolean(name);

  async function onCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — ignore.
    }
  }

  // Clicking the trigger must not bubble into the list-row `<Link>` (which
  // would open/close the message behind the popover). Stop the event and
  // open the card instead — hover already opens it, this covers quick clicks
  // before the hover delay fires.
  function onTriggerClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  const card = (
    <PreviewCardContent
      side={side}
      align={align}
      sideOffset={6}
      className={cn("w-72 p-3 select-text", className)}
    >
      <div className="flex items-start gap-3 select-text">
        <span className="flex size-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary">
          <span className="text-sm font-semibold leading-none">
            {senderInitials(name, email)}
          </span>
        </span>
        <div className="min-w-0 flex-1 space-y-0.5 select-text">
          {hasName && email ? (
            <>
              <p className="truncate text-sm font-semibold text-foreground select-text">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="truncate text-xs text-muted-foreground select-text">
                  {email}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0 select-none text-muted-foreground hover:text-foreground"
                  onClick={onCopy}
                  aria-label={copied ? "Copied" : "Copy address"}
                  title={copied ? "Copied" : "Copy address"}
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground select-text">
                {displayName}
              </p>
              {email || name ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0 select-none text-muted-foreground hover:text-foreground"
                  onClick={onCopy}
                  aria-label={copied ? "Copied" : "Copy address"}
                  title={copied ? "Copied" : "Copy address"}
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </PreviewCardContent>
  );

  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        render={<span />}
        delay={350}
        closeDelay={200}
        onClick={onTriggerClick}
        className={cn("inline-flex", triggerClassName)}
      >
        {children ?? (
          <SenderAvatar fromName={name || fromName} fromEmail={email || fromEmail} />
        )}
      </PreviewCardTrigger>
      {card}
    </PreviewCard>
  );
}

/** Dotted-underline label used as a hover-card trigger for sender names. */
export function SenderHoverLabel({
  fromName,
  fromEmail,
  children,
  className,
  side,
  align,
}: {
  fromName?: string | null;
  fromEmail?: string;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}) {
  return (
    <SenderHoverCard
      fromName={fromName}
      fromEmail={fromEmail}
      side={side}
      align={align}
      triggerClassName="min-w-0 max-w-full truncate"
    >
      <span
        className={cn(
          "truncate underline decoration-dotted underline-offset-2 hover:decoration-solid",
          className,
        )}
      >
        {children}
      </span>
    </SenderHoverCard>
  );
}
