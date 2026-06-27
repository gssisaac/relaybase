"use client";

import { usePathname } from "next/navigation";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export function EmailShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { compose } = useEmailPaths();
  const isCompose =
    pathname === compose || pathname.startsWith(`${compose}/`);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !isCompose && "overflow-auto p-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}
