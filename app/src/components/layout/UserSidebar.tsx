"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UserSidebar() {
  const pathname = usePathname();
  const userId = useProductId();
  const router = useRouter();
  const { tabs, settingsNav, domains } = useEmailPaths();
  const domainStore = useDomain();
  const domainsWorking = domainStore.isWorking;
  const {
    isDesktop,
    dragRegionClassName,
    dragRegionProps,
    noDragClassName,
    macSidebarHeaderClassName,
  } = useDesktopChrome();

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
    <aside className="flex h-full w-56 shrink-0 select-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Desktop: drag region + macOS overlay traffic-light clearance */}
      <div
        {...dragRegionProps}
        className={cn(
          "border-b border-sidebar-border px-4 py-4",
          dragRegionClassName,
          macSidebarHeaderClassName,
        )}
      >
        {isDesktop ? (
          <div
            {...dragRegionProps}
            className={cn(
              "font-semibold tracking-tight text-sidebar-foreground",
              dragRegionClassName,
            )}
          >
            Relaybase
          </div>
        ) : (
          <Link
            href="/dashboard"
            className="font-semibold tracking-tight text-sidebar-foreground"
          >
            Relaybase
          </Link>
        )}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-y-auto p-3",
          noDragClassName,
        )}
        aria-label="Main"
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
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
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.href === domains && domainsWorking ? (
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                    aria-label="Domain setup in progress"
                  />
                ) : null}
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

      <div
        className={cn(
          "space-y-2 border-t border-sidebar-border px-4 py-3",
          noDragClassName,
        )}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
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
