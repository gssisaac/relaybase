"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";

import { useRelaybasePaths } from "@/relaybase/components/useEmailSenderPaths";
import { cn } from "@/lib/utils";

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { tabs } = useRelaybasePaths();

  const nav = [
    { href: "/status", label: "Dashboard", icon: LayoutDashboard },
    { href: "/users", label: "Users", icon: Users },
    ...tabs
      .filter((tab) => ["/logs", "/settings"].includes(tab.href))
      .map((tab) => ({
        href: tab.href,
        label: tab.label,
        icon: tab.icon,
      })),
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/status"
          className="font-semibold tracking-tight text-sidebar-foreground"
        >
          Relaybase Admin
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3">
        <span className="text-xs text-muted-foreground">Dev — no auth</span>
      </div>
    </aside>
  );
}
