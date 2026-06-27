"use client";

import { EmailSettingsNav } from "@/relaybase-email/components/EmailSettingsNav";

export function EmailSettingsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden sm:flex-row sm:gap-0">
      <EmailSettingsNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:pl-6">{children}</div>
    </div>
  );
}
