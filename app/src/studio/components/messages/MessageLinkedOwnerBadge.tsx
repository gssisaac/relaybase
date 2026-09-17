"use client";

import Link from "next/link";

import { badgeVariants } from "@/components/ui/badge";
import type { MessageLinkedOwner } from "@/studio/api";
import { newsletterDetailHref, triggerDetailHref } from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

export function messageLinkedOwnerHref(owner: MessageLinkedOwner): string {
  if (owner.kind === "trigger") {
    return triggerDetailHref(owner.id, "config");
  }
  return newsletterDetailHref(owner.id, "content");
}

export function messageLinkedOwnerLabel(owner: MessageLinkedOwner): string {
  if (owner.kind === "trigger") {
    return `Trigger · ${owner.name}`;
  }
  return `Newsletter · ${owner.name}`;
}

export function MessageLinkedOwnerBadge({
  owner,
  className,
}: {
  owner: MessageLinkedOwner;
  className?: string;
}) {
  return (
    <Link
      href={messageLinkedOwnerHref(owner)}
      className={cn(badgeVariants({ variant: "secondary" }), "max-w-full truncate", className)}
    >
      {messageLinkedOwnerLabel(owner)}
    </Link>
  );
}
