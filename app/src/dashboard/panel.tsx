"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { PanelViewProps } from "@/lib/dashboard/shared/DashboardPageContent";
import { useProductHref } from "@/lib/dashboard/shared/ProductContext";
import {
  AccountDetailShell,
  type AccountDetailSection,
} from "@/dashboard/components/AccountDetailShell";
import { AccountLogsView } from "@/dashboard/components/AccountLogsView";
import { AccountOverviewView } from "@/dashboard/components/AccountOverviewView";
import { AccountSettingsView } from "@/dashboard/components/AccountSettingsView";
import { AccountsView } from "@/dashboard/components/AccountsView";
import { AudienceView } from "@/dashboard/components/AudienceView";
import { BroadcastsView } from "@/dashboard/components/BroadcastsView";
import { DomainsView } from "@/dashboard/components/DomainsView";
import { EmailSettingsKeysView } from "@/dashboard/components/EmailSettingsKeysView";
import { MetricsView } from "@/dashboard/components/MetricsView";
import { SettingsView } from "@/dashboard/components/SettingsView";
import { UserDashboardView } from "@/dashboard/components/UserDashboardView";
import {
  SuspenseComposeView,
  SuspenseMailListView,
} from "@/email/panel";

function SettingsRedirect() {
  const router = useRouter();
  const settings = useProductHref("settings");
  useEffect(() => {
    router.replace(settings);
  }, [router, settings]);
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

function AccountOverviewRedirect({ email }: { email: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/accounts/${encodeURIComponent(email)}`);
  }, [email, router]);
  return null;
}

function parseAccountSection(segment?: string): AccountDetailSection {
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
    <AccountDetailShell email={email} section={section}>
      {page}
    </AccountDetailShell>
  );
}

export function DashboardPanelView({ subPath }: PanelViewProps) {
  if (subPath.length === 0) return null;

  const [root, second, ...rest] = subPath;

  if (root === "settings") {
    if (second === "keys" || second === "aws") {
      return <KeysRedirect />;
    }
    if (second) {
      return <SettingsRedirect />;
    }
    return <SettingsView />;
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
