"use client";

import { usePathname } from "next/navigation";

import { useDashboardPaths } from "@/console/lib/paths";
import { useEmailPaths } from "@/email/lib/paths";
import { useNotificationOpenMail } from "@/lib/desktop/notify";
import { modeFromPathname } from "@/lib/navigation/sidebar-paths";
import { cn } from "@/lib/utils";

export function EmailShell({
  children,
  forceFullBleed,
}: {
  children: React.ReactNode;
  forceFullBleed?: boolean;
}) {
  const pathname = usePathname();
  useNotificationOpenMail();
  const { email } = useEmailPaths();
  const { dashboard, domains, accounts, keys, logs, settingsBase } =
    useDashboardPaths();
  // Top-level dashboard pages own DesktopTitleBar + max-w content padding.
  // Do not wrap them in EmailShell's outer p-4 / max-w (double padding).
  const dashboardScoped = [
    dashboard,
    domains,
    accounts,
    keys,
    logs,
    settingsBase,
  ].some(
    (href) =>
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith(`${href}?`),
  );
  // Web owner console uses `/email/*` in the shell; team web mail uses `/inbox`, etc.
  const isEmailAppRoute =
    pathname === "/email" ||
    pathname.startsWith("/email/") ||
    pathname.startsWith("/emails/") ||
    pathname === "/emails";

  // Studio owns DesktopTitleBar + compose/list chrome (same as mailbox / dashboard).
  // Without this, `/studio/*` falls through to the padded max-w form page.
  const isStudioRoute = modeFromPathname(pathname) === "studio";

  const isMailbox =
    forceFullBleed ||
    isEmailAppRoute ||
    pathname === email ||
    pathname.startsWith(`${email}/`) ||
    dashboardScoped ||
    isStudioRoute;

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
