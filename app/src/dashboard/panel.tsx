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
import {
  AudienceGroupDetailProvider,
} from "@/dashboard/components/AudienceGroupDetailContext";
import {
  AudienceGroupDetailShell,
  type AudienceGroupSection,
} from "@/dashboard/components/AudienceGroupDetailShell";
import { AudienceGroupContactsView } from "@/dashboard/components/AudienceGroupContactsView";
import { AudienceGroupHistoryView } from "@/dashboard/components/AudienceGroupHistoryView";
import { AudienceGroupOverviewView } from "@/dashboard/components/AudienceGroupOverviewView";
import { AudienceGroupProgressView } from "@/dashboard/components/AudienceGroupProgressView";
import { AudienceGroupSendView } from "@/dashboard/components/AudienceGroupSendView";
import { AudienceGroupSettingsView } from "@/dashboard/components/AudienceGroupSettingsView";
import { AudienceGroupsView } from "@/dashboard/components/AudienceGroupsView";
import {
  BroadcastDetailProvider,
  useBroadcastDetail,
} from "@/dashboard/components/BroadcastDetailContext";
import {
  BroadcastDetailShell,
  type BroadcastSection,
} from "@/dashboard/components/BroadcastDetailShell";
import { BroadcastAudienceView } from "@/dashboard/components/BroadcastAudienceView";
import { BroadcastContentView } from "@/dashboard/components/BroadcastContentView";
import { BroadcastDraftView } from "@/dashboard/components/BroadcastDraftView";
import { BroadcastOverviewView } from "@/dashboard/components/BroadcastOverviewView";
import { BroadcastProgressView } from "@/dashboard/components/BroadcastProgressView";
import { BroadcastsView } from "@/dashboard/components/BroadcastsView";
import { useBroadcast } from "@/lib/dashboard/BroadcastContext";
import { DomainsView } from "@/dashboard/components/DomainsView";
import { EmailSettingsKeysView } from "@/dashboard/components/EmailSettingsKeysView";
import { MetricsView } from "@/dashboard/components/MetricsView";
import { SettingsView } from "@/dashboard/components/SettingsView";
import { UserDashboardView } from "@/dashboard/components/UserDashboardView";

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
  if (segment === "logs" || segment === "settings" || segment === "overview") {
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
  const [sectionSegment] = rest;
  const section = parseAccountSection(sectionSegment);

  // Legacy compose/inbox/sent tabs (and /overview) → account root.
  if (
    sectionSegment === "overview" ||
    sectionSegment === "compose" ||
    sectionSegment === "inbox" ||
    sectionSegment === "sent"
  ) {
    return <AccountOverviewRedirect email={email} />;
  }

  let page: ReactNode = null;
  if (section === "overview") {
    page = <AccountOverviewView email={email} />;
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

function parseAudienceGroupSection(segment?: string): AudienceGroupSection {
  if (
    segment === "contacts" ||
    segment === "send" ||
    segment === "progress" ||
    segment === "history" ||
    segment === "settings" ||
    segment === "overview"
  ) {
    return segment === "overview" ? "overview" : segment;
  }
  return "overview";
}

function AudienceGroupDetailRoutes({
  groupId,
  rest,
}: {
  groupId: string;
  rest: string[];
}) {
  const [sectionSegment] = rest;
  const section = parseAudienceGroupSection(sectionSegment);

  let page: ReactNode = null;
  if (section === "contacts") {
    page = <AudienceGroupContactsView />;
  } else if (section === "send") {
    page = <AudienceGroupSendView />;
  } else if (section === "progress") {
    page = <AudienceGroupProgressView />;
  } else if (section === "history") {
    page = <AudienceGroupHistoryView />;
  } else if (section === "settings") {
    page = <AudienceGroupSettingsView />;
  } else {
    page = <AudienceGroupOverviewView />;
  }

  return (
    <AudienceGroupDetailProvider groupId={groupId}>
      <AudienceGroupDetailShell section={section}>
        {page}
      </AudienceGroupDetailShell>
    </AudienceGroupDetailProvider>
  );
}

function parseBroadcastSection(segment?: string): BroadcastSection {
  if (
    segment === "audience" ||
    segment === "content" ||
    segment === "progress" ||
    segment === "overview"
  ) {
    return segment === "overview" ? "overview" : segment;
  }
  return "overview";
}

function BroadcastDetailBody({ rest }: { rest: string[] }) {
  const { broadcastId, detail, loading, notFound } = useBroadcastDetail();
  const broadcastStore = useBroadcast();
  const [sectionSegment] = rest;
  const section = parseBroadcastSection(sectionSegment);
  const status = detail?.broadcast.status;
  const jobActive = broadcastStore.isActive(broadcastId);
  const showDraft =
    (status === "draft" || status === "failed") &&
    section !== "progress" &&
    !jobActive;

  if (loading && !detail) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading…</div>
    );
  }
  if (notFound || !detail) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Broadcast not found.
      </div>
    );
  }

  if (showDraft) {
    return <BroadcastDraftView />;
  }

  // While a background job is starting, prefer Progress over Overview.
  const effectiveSection =
    (status === "sending" || jobActive) && section === "overview"
      ? "progress"
      : section;

  let page: ReactNode = null;
  if (effectiveSection === "audience") {
    page = <BroadcastAudienceView />;
  } else if (effectiveSection === "content") {
    page = <BroadcastContentView />;
  } else if (effectiveSection === "progress") {
    page = <BroadcastProgressView />;
  } else {
    page = <BroadcastOverviewView />;
  }

  return (
    <BroadcastDetailShell section={effectiveSection}>
      {page}
    </BroadcastDetailShell>
  );
}

function BroadcastDetailRoutes({
  broadcastId,
  rest,
}: {
  broadcastId: string;
  rest: string[];
}) {
  return (
    <BroadcastDetailProvider broadcastId={broadcastId}>
      <BroadcastDetailBody rest={rest} />
    </BroadcastDetailProvider>
  );
}

function BroadcastNewRedirect() {
  const router = useRouter();
  const broadcasts = useProductHref("broadcasts");
  useEffect(() => {
    router.replace(`${broadcasts}?new=1`);
  }, [broadcasts, router]);
  return null;
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

  if (root === "audience") {
    if (!second) return <AudienceGroupsView />;
    const groupId = decodeURIComponent(second);
    return <AudienceGroupDetailRoutes groupId={groupId} rest={rest} />;
  }

  if (root === "broadcasts") {
    if (!second) return <BroadcastsView />;
    if (second === "new") return <BroadcastNewRedirect />;
    const broadcastId = decodeURIComponent(second);
    return (
      <BroadcastDetailRoutes broadcastId={broadcastId} rest={rest} />
    );
  }

  switch (root) {
    case "dashboard":
      return <UserDashboardView />;
    case "domains":
      return <DomainsView />;
    case "keys":
      return <EmailSettingsKeysView />;
    case "metrics":
      return <MetricsView />;
    default:
      return null;
  }
}
