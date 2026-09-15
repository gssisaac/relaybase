"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type CrmSectionNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
};

export function CrmDetailSectionNav({
  items,
  activeId,
}: {
  items: CrmSectionNavItem[];
  activeId: string;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Sections">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "inline-flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
