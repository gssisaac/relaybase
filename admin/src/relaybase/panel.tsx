"use client";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { EmailSenderBrandingView } from "@/relaybase/components/EmailSenderBrandingView";
import { EmailSenderComposeView } from "@/relaybase/components/EmailSenderComposeView";
import { EmailSenderEmailsView } from "@/relaybase/components/EmailSenderEmailsView";
import { EmailSenderKeysView } from "@/relaybase/components/EmailSenderKeysView";
import { EmailSenderLogsView } from "@/relaybase/components/EmailSenderLogsView";
import { EmailSenderSettingsView } from "@/relaybase/components/EmailSenderSettingsView";
import { EmailSenderShell } from "@/relaybase/components/EmailSenderShell";
import { AdminDashboardView } from "@/components/dashboard/AdminDashboardView";

function EmailSenderView({ subPath }: PanelViewProps) {
  const [head, second] = subPath;

  if (head === "logs") return <EmailSenderLogsView />;
  if (head === "keys") return <EmailSenderKeysView />;
  if (head === "branding") return <EmailSenderBrandingView />;
  if (head === "email") {
    if (second === "compose") return <EmailSenderComposeView />;
    return <EmailSenderEmailsView />;
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
