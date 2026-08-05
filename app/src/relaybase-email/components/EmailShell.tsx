"use client";

import { usePathname } from "next/navigation";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export function EmailShell({
  children,
  forceFullBleed,
}: {
  children: React.ReactNode;
  forceFullBleed?: boolean;
}) {
  const pathname = usePathname();
  const { emails, accounts } = useEmailPaths();
  const isMailbox =
    forceFullBleed ||
    pathname === emails ||
    pathname.startsWith(`${emails}/`) ||
    (pathname.startsWith(`${accounts}/`) && pathname !== accounts);

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
