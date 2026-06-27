"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { usePanelHref } from "@/lib/dashboard/shared/ProductContext";
import { AccountsView } from "@/relaybase-email/components/AccountsView";
import { AudienceView } from "@/relaybase-email/components/AudienceView";
import { BroadcastsView } from "@/relaybase-email/components/BroadcastsView";
import { ComposeView } from "@/relaybase-email/components/ComposeView";
import { DomainsView } from "@/relaybase-email/components/DomainsView";
import { EmailPageSuspenseFallback } from "@/relaybase-email/components/EmailPageSuspenseFallback";
import { EmailSettingsKeysView } from "@/relaybase-email/components/EmailSettingsKeysView";
import { EmailSettingsDomainView } from "@/relaybase-email/components/EmailSettingsDomainView";
import { EmailSettingsShell } from "@/relaybase-email/components/EmailSettingsShell";
import { EmailShell } from "@/relaybase-email/components/EmailShell";
import { EmailsView } from "@/relaybase-email/components/EmailsView";
import { MetricsView } from "@/relaybase-email/components/MetricsView";
import { UserDashboardView } from "@/relaybase-email/components/UserDashboardView";

function EmailIndexRedirect() {
  const router = useRouter();
  const dashboard = usePanelHref("dashboard");
  useEffect(() => {
    router.replace(dashboard);
  }, [router, dashboard]);
  return null;
}

function SettingsIndexRedirect() {
  const router = useRouter();
  const settingsKeys = usePanelHref("settings", "keys");
  useEffect(() => {
    router.replace(settingsKeys);
  }, [router, settingsKeys]);
  return null;
}

function SuspenseEmailsView() {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <EmailsView />
    </Suspense>
  );
}

function SuspenseComposeView() {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <ComposeView />
    </Suspense>
  );
}

function EmailView({ subPath }: PanelViewProps) {
  if (subPath.length === 0) {
    return <EmailIndexRedirect />;
  }

  const [root, second] = subPath;

  if (root === "settings") {
    if (!second || second === "keys" || second === "aws") {
      return <EmailSettingsKeysView />;
    }
    if (second === "domain") return <EmailSettingsDomainView />;
    return <SettingsIndexRedirect />;
  }

  if (root === "emails" && second === "compose") {
    return <SuspenseComposeView />;
  }

  switch (root) {
    case "dashboard":
      return <UserDashboardView />;
    case "domains":
      return <DomainsView />;
    case "accounts":
      return <AccountsView />;
    case "audience":
      return <AudienceView />;
    case "broadcasts":
      return <BroadcastsView />;
    case "emails":
      return <SuspenseEmailsView />;
    case "metrics":
      return <MetricsView />;
    default:
      return null;
  }
}

export function RelaybaseEmailPanelView({ subPath }: PanelViewProps) {
  const [root] = subPath;
  const isSettings = root === "settings";

  return (
    <EmailShell>
      {isSettings ? (
        <EmailSettingsShell>
          <EmailView subPath={subPath} />
        </EmailSettingsShell>
      ) : (
        <EmailView subPath={subPath} />
      )}
    </EmailShell>
  );
}
