"use client";

import Link from "next/link";

import {
  broadcastsSectionHref,
  type BroadcastsSection,
} from "@/crm/lib/paths";
import { cn } from "@/lib/utils";

const SECTIONS: { id: BroadcastsSection; label: string }[] = [
  { id: "list", label: "Broadcasts" },
  { id: "sent", label: "Sent" },
  { id: "in-progress", label: "In progress" },
];

export function BroadcastsSectionNav({
  active,
}: {
  active: BroadcastsSection;
}) {
  return (
    <nav
      className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5"
      aria-label="Broadcast sections"
    >
      {SECTIONS.map((section) => {
        const href = broadcastsSectionHref(section.id);
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
