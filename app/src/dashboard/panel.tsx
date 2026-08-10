"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  accountDetailFromSearch,
  accountDetailHref,
  audienceDetailFromSearch,
  audienceDetailHref,
  broadcastDetailFromSearch,
  broadcastDetailHref,
  type AccountDetailTab,
  type AudienceDetailTab,
  type BroadcastDetailTab,
} from "@/dashboard/paths";
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
    router.replace(accountDetailHref(email));
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
  section,
}: {
  email: string;
  section: AccountDetailSection;
}) {
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

function AccountsRoutes({
  pathEmail,
  pathRest,
}: {
  pathEmail?: string;
  pathRest: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = accountDetailFromSearch(searchParams);
  const pathSectionSegment = pathRest[0];
  const pathSection = parseAccountSection(pathSectionSegment);
  const email = fromQuery?.email ?? pathEmail;
  const section: AccountDetailTab = fromQuery?.tab ?? pathSection;

  // Migrate legacy `/accounts/{email}/…` → `/accounts?email=&tab=` (static-safe).
  useEffect(() => {
    if (!pathEmail || fromQuery) return;
    if (
      pathSectionSegment === "overview" ||
      pathSectionSegment === "compose" ||
      pathSectionSegment === "inbox" ||
      pathSectionSegment === "sent"
    ) {
      router.replace(accountDetailHref(pathEmail));
      return;
    }
    router.replace(accountDetailHref(pathEmail, section));
  }, [fromQuery, pathEmail, pathSectionSegment, router, section]);

  if (!email) return <AccountsView />;
  if (pathEmail && !fromQuery) return null;
  return <AccountDetailRoutes email={email} section={section} />;
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
  section,
}: {
  groupId: string;
  section: AudienceGroupSection;
}) {
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

function AudienceRoutes({
  pathGroupId,
  pathRest,
}: {
  pathGroupId?: string;
  pathRest: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = audienceDetailFromSearch(searchParams);
  const pathSection = parseAudienceGroupSection(pathRest[0]);
  const groupId = fromQuery?.groupId ?? pathGroupId;
  const section: AudienceDetailTab = fromQuery?.tab ?? pathSection;

  useEffect(() => {
    if (!pathGroupId || fromQuery) return;
    router.replace(audienceDetailHref(pathGroupId, section));
  }, [fromQuery, pathGroupId, router, section]);

  if (!groupId) return <AudienceGroupsView />;
  if (pathGroupId && !fromQuery) return null;
  return <AudienceGroupDetailRoutes groupId={groupId} section={section} />;
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

function BroadcastDetailBody({ section }: { section: BroadcastSection }) {
  const { broadcastId, detail, loading, notFound } = useBroadcastDetail();
  const broadcastStore = useBroadcast();
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
  section,
}: {
  broadcastId: string;
  section: BroadcastSection;
}) {
  return (
    <BroadcastDetailProvider broadcastId={broadcastId}>
      <BroadcastDetailBody section={section} />
    </BroadcastDetailProvider>
  );
}

function BroadcastsRoutes({
  pathBroadcastId,
  pathRest,
  pathIsNew,
}: {
  pathBroadcastId?: string;
  pathRest: string[];
  pathIsNew?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuery = broadcastDetailFromSearch(searchParams);
  const pathSection = parseBroadcastSection(pathRest[0]);
  const broadcastId = fromQuery?.broadcastId ?? pathBroadcastId;
  const section: BroadcastDetailTab = fromQuery?.tab ?? pathSection;

  useEffect(() => {
    if (pathIsNew && !fromQuery) {
      router.replace("/broadcasts?new=1");
      return;
    }
    if (!pathBroadcastId || fromQuery) return;
    router.replace(broadcastDetailHref(pathBroadcastId, section));
  }, [fromQuery, pathBroadcastId, pathIsNew, router, section]);

  if (pathIsNew && !fromQuery) return null;
  if (!broadcastId) return <BroadcastsView />;
  if (pathBroadcastId && !fromQuery) return null;
  return (
    <BroadcastDetailRoutes broadcastId={broadcastId} section={section} />
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
    const pathEmail =
      second && decodeURIComponent(second).includes("@")
        ? decodeURIComponent(second)
        : undefined;
    return (
      <Suspense fallback={null}>
        <AccountsRoutes pathEmail={pathEmail} pathRest={pathEmail ? rest : []} />
      </Suspense>
    );
  }

  if (root === "audience") {
    const pathGroupId = second ? decodeURIComponent(second) : undefined;
    return (
      <Suspense fallback={null}>
        <AudienceRoutes
          pathGroupId={pathGroupId}
          pathRest={pathGroupId ? rest : []}
        />
      </Suspense>
    );
  }

  if (root === "broadcasts") {
    if (second === "new") {
      return (
        <Suspense fallback={null}>
          <BroadcastsRoutes pathIsNew pathRest={[]} />
        </Suspense>
      );
    }
    const pathBroadcastId = second ? decodeURIComponent(second) : undefined;
    return (
      <Suspense fallback={null}>
        <BroadcastsRoutes
          pathBroadcastId={pathBroadcastId}
          pathRest={pathBroadcastId ? rest : []}
        />
      </Suspense>
    );
  }

  switch (root) {
    case "dashboard":
      return <UserDashboardView />;
    case "domains":
      return <DomainsView />;
    case "keys":
      return <EmailSettingsKeysView />;
    default:
      return null;
  }
}
