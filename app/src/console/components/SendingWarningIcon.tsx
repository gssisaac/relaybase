"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "p-0 text-amber-600 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400",
              size === "sm" ? "h-4 w-4" : "h-7 w-7",
              className,
            )}
            aria-label="Sending restriction"
            onClick={(event) => {
              event.preventDefault();
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
