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
import { EmailMailboxProvider } from "@/relaybase-email/components/EmailMailboxContext";
import {
  EmailMailboxLayout,
  type EmailMailboxSection,
} from "@/relaybase-email/components/EmailMailboxLayout";
import { EmailPageSuspenseFallback } from "@/relaybase-email/components/EmailPageSuspenseFallback";
import { EmailSettingsKeysView } from "@/relaybase-email/components/EmailSettingsKeysView";
import { EmailSettingsDomainView } from "@/relaybase-email/components/EmailSettingsDomainView";
import { EmailSettingsShell } from "@/relaybase-email/components/EmailSettingsShell";
import { EmailShell } from "@/relaybase-email/components/EmailShell";
import { MailListView } from "@/relaybase-email/components/MailListView";
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

function EmailsInboxRedirect() {
  const router = useRouter();
  const inbox = usePanelHref("emails", "inbox");
  useEffect(() => {
    router.replace(inbox);
  }, [inbox, router]);
  return null;
}

function EmailMailboxPage({
  section,
  children,
}: {
  section: EmailMailboxSection;
  children: ReactNode;
}) {
  return (
    <EmailMailboxProvider>
      <EmailMailboxLayout section={section}>{children}</EmailMailboxLayout>
    </EmailMailboxProvider>
  );
}

function SuspenseMailListView({
  folder,
}: {
  folder: Extract<EmailMailboxSection, "inbox" | "sent">;
}) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <MailListView folder={folder} />
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

function EmailMailboxRoutes({ second }: { second?: string }) {
  if (!second) {
    return <EmailsInboxRedirect />;
  }

  if (second === "inbox") {
    return (
      <EmailMailboxPage section="inbox">
        <SuspenseMailListView folder="inbox" />
      </EmailMailboxPage>
    );
  }

  if (second === "sent") {
    return (
      <EmailMailboxPage section="sent">
        <SuspenseMailListView folder="sent" />
      </EmailMailboxPage>
    );
  }

  if (second === "compose") {
    return (
      <EmailMailboxPage section="compose">
        <SuspenseComposeView />
      </EmailMailboxPage>
    );
  }

  return <EmailsInboxRedirect />;
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

  if (root === "emails") {
    return <EmailMailboxRoutes second={second} />;
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
