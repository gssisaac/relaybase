"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { newsletterDetailHref } from "@/studio/lib/paths";
import type { ScheduleItem } from "@/studio/lib/schedule/schedule-items";
import {
  formatScheduleEventTime,
  formatScheduleWhen,
} from "@/studio/lib/schedule/schedule-timezone";
import { cn } from "@/lib/utils";

type ScheduleItemPopoverProps = {
  item: ScheduleItem;
  variant: "list" | "nextUp" | "calendar";
  timeZone: string;
  listInsetClassName?: string;
  nextUpInsetClassName?: string;
};

function ScheduleItemPopoverContent({
  item,
  timeZone,
}: {
  item: ScheduleItem;
  timeZone: string;
}) {
  const href = newsletterDetailHref(item.newsletterId, "publish", item.status);
  const subscriberGroup = item.subscriberGroupLabel ?? "Subscriber group";

  return (
    <>
      <div className="flex items-start gap-1">
        <PopoverHeader className="min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-2 pr-1">
            <PopoverTitle className="min-w-0 text-base leading-snug">{item.title}</PopoverTitle>
            <NewsletterStatusBadge status={item.status} />
          </div>
          <PopoverDescription className="line-clamp-3 break-words">{item.subject}</PopoverDescription>
        </PopoverHeader>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          nativeButton={false}
          render={<Link href={href} aria-label="Open newsletter" />}
        >
          <ExternalLink className="size-4" aria-hidden />
        </Button>
      </div>
      <dl className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>Scheduled</dt>
          <dd className="text-right tabular-nums text-foreground">
            {formatScheduleWhen(item.at, timeZone)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Subscriber group</dt>
          <dd className="min-w-0 truncate text-right text-foreground">{subscriberGroup}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Subscribers</dt>
          <dd className="tabular-nums text-foreground">{item.recipientCount.toLocaleString()}</dd>
        </div>
      </dl>
    </>
  );
}

function triggerLabel(
  item: ScheduleItem,
  variant: ScheduleItemPopoverProps["variant"],
  timeZone: string,
): ReactNode {
  if (variant === "nextUp") {
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">Next up</p>
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.subject}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {formatScheduleWhen(item.at, timeZone)} · {item.subscriberGroupLabel ?? "Subscriber group"} ·{" "}
          {item.recipientCount.toLocaleString()} recipients
        </p>
      </>
    );
  }

  if (variant === "calendar") {
    return (
      <>
        <span className="font-medium tabular-nums text-primary/90">
          {formatScheduleEventTime(item.at, timeZone)}
        </span>{" "}
        <span>{item.title}</span>
      </>
    );
  }

  return (
    <>
      <span className="min-w-0 truncate font-medium">{item.title}</span>
      <div className="flex shrink-0 items-center gap-2">
        <NewsletterStatusBadge status={item.status} />
        <span className="text-xs text-muted-foreground">
          {formatScheduleWhen(item.at, timeZone)}
        </span>
      </div>
    </>
  );
}

export function ScheduleItemPopover({
  item,
  variant,
  timeZone,
  listInsetClassName,
  nextUpInsetClassName,
}: ScheduleItemPopoverProps) {
  const triggerClassName = cn(
    variant === "nextUp" && [
      nextUpInsetClassName,
      "block w-full text-left transition-colors hover:opacity-95",
    ],
    variant === "list" && [
      listInsetClassName,
      "flex w-full items-center justify-between gap-2 text-left text-sm",
    ],
    variant === "calendar" &&
      "block min-w-0 truncate rounded-sm bg-primary/15 px-1 py-0.5 text-left text-[10px] leading-tight text-foreground hover:bg-primary/25 sm:text-[11px]",
  );

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={triggerClassName}
            title={
              variant === "calendar"
                ? `${formatScheduleEventTime(item.at, timeZone)} — ${item.title}`
                : undefined
            }
          />
        }
      >
        {triggerLabel(item, variant, timeZone)}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={variant === "list" || variant === "nextUp" ? "right" : "bottom"}
        className="w-80 max-w-[min(20rem,calc(100vw-2rem))]"
      >
        <ScheduleItemPopoverContent item={item} timeZone={timeZone} />
      </PopoverContent>
    </Popover>
  );
}
