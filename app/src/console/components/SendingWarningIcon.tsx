"use client";

import { AlertTriangle } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  isSendingWarningStatus,
  sendingBadgeLabel,
  sendingWarningDescription,
  showSendingCloudflareLink,
  type SendingHealthDomain,
} from "@/lib/dashboard/sending-health";
import { useDesktop } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export function SendingWarningIcon({
  entry,
  size = "default",
  className,
}: {
  entry: SendingHealthDomain | null | undefined;
  size?: "sm" | "default";
  className?: string;
}) {
  const { teamLogin } = useDesktop();
  if (!entry || !isSendingWarningStatus(entry.status)) return null;
  const audience = teamLogin ? "team" : "owner";
  const iconClass = size === "sm" ? "size-3" : "size-3.5";
  const description = sendingWarningDescription(
    entry.status,
    audience,
    entry.error,
  );
  const cloudflareUrl = showSendingCloudflareLink(
    audience,
    entry.cloudflareSendingUrl,
  )
    ? entry.cloudflareSendingUrl
    : null;

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md text-amber-600 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400 dark:hover:text-amber-400",
              size === "sm" ? "size-4" : "size-7",
              className,
            )}
            aria-label="Sending restriction"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          />
        }
      >
        <AlertTriangle className={iconClass} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-w-[min(18rem,calc(100vw-2rem))]"
      >
        <PopoverHeader>
          <PopoverTitle>Sending {sendingBadgeLabel(entry.status)}</PopoverTitle>
          <PopoverDescription className="break-words">
            {description}
          </PopoverDescription>
        </PopoverHeader>
        {cloudflareUrl ? (
          <a
            href={cloudflareUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Open Cloudflare
          </a>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
