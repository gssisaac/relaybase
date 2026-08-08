"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { useProductHref } from "@/lib/dashboard/shared/ProductContext";
import { AccountDetailShell, type AccountDetailSection } from "@/relaybase-email/components/AccountDetailShell";
import { AccountLogsView } from "@/relaybase-email/components/AccountLogsView";
import { AccountOverviewView } from "@/relaybase-email/components/AccountOverviewView";
import { AccountSettingsView } from "@/relaybase-email/components/AccountSettingsView";
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
  const dashboard = useProductHref("dashboard");
  useEffect(() => {
    router.replace(dashboard);
  }, [router, dashboard]);
  return null;
}

function SettingsIndexRedirect() {
  const router = useRouter();
  const settingsDomain = useProductHref("settings", "domain");
  useEffect(() => {
    router.replace(settingsDomain);
  }, [router, settingsDomain]);
  return null;
}

function KeysRedirect() {
  const router = useRouter();
  const keys = useProductHref("keys");
  useEffect(() => {
    router.replace(keys);
  }, [keys, router]);
  return null;
}

function EmailsInboxRedirect() {
  const router = useRouter();
  const inbox = useProductHref("emails", "inbox");
  useEffect(() => {
    router.replace(inbox);
  }, [inbox, router]);
  return null;
}

function AccountOverviewRedirect({ email }: { email: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/accounts/${encodeURIComponent(email)}`);
  }, [email, router]);
  return null;
}

function SuspenseMailListView({
  folder,
  messageId,
}: {
  folder: Extract<EmailMailboxSection, "inbox" | "sent">;
  messageId?: string;
}) {
  return (
    <Suspense fallback={<EmailPageSuspenseFallback />}>
      <MailListView folder={folder} messageId={messageId} />
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

function mailboxSection(second?: string): EmailMailboxSection | null {
  if (second === "inbox" || second === "sent" || second === "compose") {
    return second;
  }
  return null;
}

function EmailMailboxRoutes({
  second,
  rest,
}: {
  second?: string;
  rest: string[];
}) {
  const section = mailboxSection(second);
  if (!section) {
    return <EmailsInboxRedirect />;
  }

  const messageId =
    rest.length > 0
      ? rest.map((segment) => decodeURIComponent(segment)).join("/")
      : undefined;

  let page: ReactNode = null;
  if (section === "inbox") {
    page = <SuspenseMailListView folder="inbox" messageId={messageId} />;
  } else if (section === "sent") {
    page = <SuspenseMailListView folder="sent" messageId={messageId} />;
  } else {
    page = <SuspenseComposeView />;
  }

  return (
    <EmailMailboxProvider>
      <Suspense fallback={<EmailPageSuspenseFallback />}>
        <EmailMailboxLayout section={section}>{page}</EmailMailboxLayout>
      </Suspense>
    </EmailMailboxProvider>
  );
}

function parseAccountSection(
  segment?: string,
): AccountDetailSection {
  if (
    segment === "compose" ||
    segment === "inbox" ||
    segment === "sent" ||
    segment === "logs" ||
    segment === "settings" ||
    segment === "overview"
  ) {
    return segment === "overview" ? "overview" : segment;
  }
  return "overview";
}

function AccountDetailRoutes({
  email,
  rest,
}: {
  email: string;
  rest: string[];
}) {
  const [sectionSegment, ...tail] = rest;
  const section = parseAccountSection(sectionSegment);

  // /accounts/:email/overview → canonicalize to /accounts/:email
  if (sectionSegment === "overview") {
    return <AccountOverviewRedirect email={email} />;
  }

  const messageId =
    (section === "inbox" || section === "sent") && tail.length > 0
      ? tail.map((segment) => decodeURIComponent(segment)).join("/")
      : undefined;

  let page: ReactNode = null;
  if (section === "overview") {
    page = <AccountOverviewView email={email} />;
  } else if (section === "compose") {
    page = <SuspenseComposeView />;
  } else if (section === "inbox") {
    page = <SuspenseMailListView folder="inbox" messageId={messageId} />;
  } else if (section === "sent") {
    page = <SuspenseMailListView folder="sent" messageId={messageId} />;
  } else if (section === "logs") {
    page = <AccountLogsView email={email} />;
  } else {
    page = <AccountSettingsView email={email} />;
  }

  return (
    <EmailMailboxProvider>
      <AccountDetailShell email={email} section={section}>
        {page}
      </AccountDetailShell>
    </EmailMailboxProvider>
  );
}

function EmailView({ subPath }: PanelViewProps) {
  if (subPath.length === 0) {
    return <EmailIndexRedirect />;
  }

  const [root, second, ...rest] = subPath;

  if (root === "settings") {
    if (second === "keys" || second === "aws") {
      return <KeysRedirect />;
    }
    if (!second) return <SettingsIndexRedirect />;
    if (second === "domain") return <EmailSettingsDomainView />;
    return <SettingsIndexRedirect />;
  }

  if (root === "emails") {
    return <EmailMailboxRoutes second={second} rest={rest} />;
  }

  if (root === "accounts") {
    if (!second) return <AccountsView />;
    const email = decodeURIComponent(second);
    if (!email.includes("@")) return <AccountsView />;
    return <AccountDetailRoutes email={email} rest={rest} />;
  }

  switch (root) {
    case "dashboard":
      return <UserDashboardView />;
    case "domains":
      return <DomainsView />;
    case "keys":
      return <EmailSettingsKeysView />;
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
  const isAccountDetail = root === "accounts" && subPath.length > 1;
  const isMailbox = root === "emails" || isAccountDetail;

  return (
    <EmailShell forceFullBleed={isMailbox}>
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
