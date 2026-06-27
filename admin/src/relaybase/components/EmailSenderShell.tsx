"use client";

import { usePathname } from "next/navigation";

import { useEmailSenderPaths } from "@/relaybase/components/useEmailSenderPaths";
import { cn } from "@/lib/utils";

import { EmailSenderTabNav } from "./EmailSenderTabNav";

export function EmailSenderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { compose } = useEmailSenderPaths();
  const isCompose =
    pathname === compose || pathname.startsWith(`${compose}/`);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!isCompose ? <EmailSenderTabNav className="shrink-0" /> : null}
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
