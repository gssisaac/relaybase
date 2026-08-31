"use client";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { EmailSenderSettingsView } from "@/relaybase/components/EmailSenderSettingsView";
import { EmailSenderShell } from "@/relaybase/components/EmailSenderShell";
import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";

function RetiredWorkerProxy() {
  return (
    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Retired</p>
      <p className="mt-1">
        HQ admin no longer calls the product Worker. Use the desktop app with
        an owner passtoken for mail, keys, branding, and logs.
      </p>
    </div>
  );
}

function EmailSenderView({ subPath }: PanelViewProps) {
  const [head] = subPath;

  if (head === "logs" || head === "keys" || head === "branding" || head === "email") {
    return <RetiredWorkerProxy />;
  }
  if (head === "settings") return <EmailSenderSettingsView />;
  return <AdminDashboardView />;
}

export function EmailSenderPanelView({ subPath }: PanelViewProps) {
  return (
    <EmailSenderShell>
      <EmailSenderView subPath={subPath} />
    </EmailSenderShell>
  );
}
