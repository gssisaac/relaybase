"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export function EmailSettingsNav() {
  const pathname = usePathname();
  const { settingsNav } = useEmailPaths();

  return (
    <nav
      className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border pb-3 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4"
      aria-label="Email settings"
    >
      {settingsNav.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
