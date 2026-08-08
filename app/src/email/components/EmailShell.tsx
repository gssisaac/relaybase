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
  const { accounts, keys, broadcasts, audience } = useDashboardPaths();
  const domainScoped =
    pathname === accounts ||
    pathname.startsWith(`${accounts}/`) ||
    pathname === keys ||
    pathname.startsWith(`${keys}/`) ||
    pathname === broadcasts ||
    pathname.startsWith(`${broadcasts}/`) ||
    pathname === audience ||
    pathname.startsWith(`${audience}/`);
  const isMailbox =
    forceFullBleed ||
    pathname === email ||
    pathname.startsWith(`${email}/`) ||
    pathname.startsWith("/emails/") ||
    pathname === "/emails" ||
    domainScoped;

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
