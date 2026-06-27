"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { cn } from "@/lib/utils";

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UserSidebar() {
  const pathname = usePathname();
  const userId = useProductId();
  const router = useRouter();
  const { tabs, settingsNav } = useEmailPaths();

  const inSettings = pathname.startsWith("/settings");

  const nav = tabs.map((tab) => ({
    href: tab.href,
    label: tab.label,
    icon: tab.icon,
  }));

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/dashboard"
          className="font-semibold tracking-tight text-sidebar-foreground"
        >
          Relaybase
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Main">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/settings"
              ? inSettings
              : isActive(item.href, pathname);

          return (
            <div key={item.href}>
              <Link
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
              {item.href === "/settings" && inSettings ? (
                <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                  {settingsNav.map((sub) => {
                    const subActive = isActive(sub.href, pathname);
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          subActive
                            ? "text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:text-sidebar-foreground",
                        )}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-4 py-3">
        <p className="truncate font-mono text-xs text-muted-foreground" title={userId}>
          {userId}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
