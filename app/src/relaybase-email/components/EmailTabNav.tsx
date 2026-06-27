"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export function EmailTabNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { tabs } = useEmailPaths();

  return (
    <nav
      className={cn(
        "flex min-w-0 gap-0 border-b border-border bg-background/80 px-4 backdrop-blur",
        className,
      )}
      aria-label="Email sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
