"use client";

import Link from "next/link";

import {
  newslettersSectionHref,
  type NewslettersSection,
} from "@/studio/lib/paths";
import { cn } from "@/lib/utils";

const SECTIONS: { id: NewslettersSection; label: string }[] = [
  { id: "list", label: "Newsletters" },
  { id: "sent", label: "Sent" },
  { id: "in-progress", label: "In progress" },
];

export function NewslettersSectionNav({
  active,
}: {
  active: NewslettersSection;
}) {
  return (
    <nav
      className="inline-flex max-w-full items-center overflow-x-auto rounded-lg bg-muted p-0.5"
      aria-label="Newsletter sections"
    >
      {SECTIONS.map((section) => {
        const href = newslettersSectionHref(section.id);
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
