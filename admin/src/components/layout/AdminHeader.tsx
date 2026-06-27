"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/status", label: "Dashboard" },
  { href: "/users", label: "Users" },
];

export function AdminHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/status" className="font-semibold tracking-tight">
            Relaybase Admin
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  pathname === item.href ||
                    (item.href !== "/users" && pathname.startsWith(item.href))
                    ? "bg-muted text-foreground"
                    : undefined,
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <span className="text-xs text-muted-foreground">Dev — no auth</span>
      </div>
    </header>
  );
}
