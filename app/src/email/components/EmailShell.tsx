"use client";

import { usePathname } from "next/navigation";

import { useDashboardPaths } from "@/dashboard/paths";
import { useEmailPaths } from "@/email/paths";
import { cn } from "@/lib/utils";

export function EmailShell({
  children,
  forceFullBleed,
}: {
  children: React.ReactNode;
  forceFullBleed?: boolean;
}) {
  const pathname = usePathname();
  const { email } = useEmailPaths();
  const {
    dashboard,
    domains,
    accounts,
    keys,
    logs,
    broadcasts,
    audience,
    settingsBase,
  } = useDashboardPaths();
  // Top-level dashboard pages own DesktopTitleBar + max-w content padding.
  // Do not wrap them in EmailShell's outer p-4 / max-w (double padding).
  const dashboardScoped = [
    dashboard,
    domains,
    accounts,
    keys,
    logs,
    broadcasts,
    audience,
    settingsBase,
  ].some(
    (href) =>
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith(`${href}?`),
  );
  const isMailbox =
    forceFullBleed ||
    pathname === email ||
    pathname.startsWith(`${email}/`) ||
    pathname.startsWith("/emails/") ||
    pathname === "/emails" ||
    dashboardScoped;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isMailbox ? "overflow-hidden" : "overflow-auto p-4",
        )}
      >
        {isMailbox ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        )}
      </div>
    </div>
  );
}
