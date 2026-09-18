"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";

import { AppHotkeys } from "@/components/layout/AppHotkeys";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { AppShellFrame } from "@/components/layout/app-shell-nav";
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { ConsoleAppProviders, WebConsoleAppProviders } from "@/mail-platform/runtime";
import { AccountsProvider } from "@/lib/dashboard/AccountsContext";
import { AccountsSyncBridge } from "@/lib/dashboard/AccountsSyncBridge";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SendingHealthProvider } from "@/lib/dashboard/SendingHealthContext";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { EnableEmailApiDialogHost } from "@/console/components/setup/common/update/use-enable-email-api-dialog";
import { ConsoleRouteGate } from "@/console/components/setup/common/layout/ConsoleRouteGate";
import { useAppSession } from "@/lib/desktop/app-session";
import { restoreWebOwnerSession } from "@/lib/desktop/auth";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { isStudioSettingsPath } from "@/lib/navigation/studio-settings-path";
import { hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

function isStudioShellPath(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}
import { DomainProgressBanner } from "@/console/components/DomainProgressBanner";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";
import { SessionPhaseScreen } from "@/console/components/setup/common/layout/SessionPhaseScreen";

const LOCAL_OPERATOR_USER_ID = "desktop";
const WEB_OWNER_USER_ID = "web-owner";

/** Console-scoped dashboard stores — mount only after the route gate passes. */
function OwnerConsoleDashboard({ children }: { children: ReactNode }) {
  return (
    <AccountsProvider>
      <AccountsSyncBridge />
      {children}
    </AccountsProvider>
  );
}

function DashboardShell({
  userId,
  teamMode = false,
  children,
}: {
  userId: string;
  teamMode?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isEmailSettings =
    pathname === "/email/settings" || pathname.startsWith("/email/settings?");
  const hideMainSidebar = isEmailSettings || isStudioSettingsPath(pathname);

  if (teamMode) {
    return (
      <SessionProvider userId={userId}>
        <DomainProvider>
          <SendingHealthProvider>
          <MailAccountsProvider>
            <SenderIconProvider>
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <AppShellFrame teamMode hideSidebar={hideMainSidebar}>
                    {children}
                  </AppShellFrame>
                  <AppHotkeys />
                  <GlobalCommandPalette />
                </EmailCommandRuntimeProvider>
              </EmailMailboxProvider>
            </SenderIconProvider>
          </MailAccountsProvider>
          </SendingHealthProvider>
        </DomainProvider>
      </SessionProvider>
    );
  }
  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <SendingHealthProvider>
        <MailAccountsProvider>
          <SenderIconProvider>
            <EmailMailboxProvider>
              <EmailCommandRuntimeProvider>
                <DisableAppTabFocus />
                <AppShellFrame hideSidebar={hideMainSidebar}>
                  <ConsoleRouteGate>
                    <OwnerConsoleDashboard>
                      {hideMainSidebar ? null : <DomainProgressBanner />}
                      {children}
                    </OwnerConsoleDashboard>
                  </ConsoleRouteGate>
                </AppShellFrame>
                <AppHotkeys />
                <GlobalCommandPalette />
              </EmailCommandRuntimeProvider>
            </EmailMailboxProvider>
          </SenderIconProvider>
        </MailAccountsProvider>
        </SendingHealthProvider>
      </DomainProvider>
    </SessionProvider>
  );
}

function GateInner({ children }: { children: ReactNode }) {
  const store = useAppSession();
  return (
    <SessionPhaseScreen>
      {(role) =>
        role === "invited" ? (
          <DashboardShell
            userId={store.teamStatus?.accountEmail ?? "team"}
            teamMode
          >
            {children}
          </DashboardShell>
        ) : (
          <DashboardShell userId={LOCAL_OPERATOR_USER_ID}>
            {children}
          </DashboardShell>
        )
      }
    </SessionPhaseScreen>
  );
}

/**
 * Web owner: no keyring / Touch ID phase machine — `hasWebOwnerSession()`
 * (in-memory access token from `webOwnerLogin()`, or re-minted from tab
 * sessionStorage by `restoreWebOwnerSession()` after a reload) is the whole
 * gate. Unauthenticated web visitors go to `/login`. Reuses the same DashboardShell as
 * desktop's owner path, just under WebConsoleAppProviders instead of
 * DesktopShell + ConsoleAppProviders.
 */
function WebOwnerGate({ children }: { children: ReactNode }) {
  return (
    <WebConsoleAppProviders>
      <EnableEmailApiDialogHost>
        <DashboardShell userId={WEB_OWNER_USER_ID}>{children}</DashboardShell>
      </EnableEmailApiDialogHost>
    </WebConsoleAppProviders>
  );
}

/**
 * Single dashboard chrome for every run mode. The phase switch is the only
 * gate — no scattered `hasOwnerSession()` / `ownerAccess` checks. Credentials
 * come from the root `DesktopProvider` (see `AppProviders`).
 */
type DashboardGateMode = "loading" | "desktop" | "web-owner" | "web-redirect";

export function DesktopDashboardGate({
  children,
}: {
  children: ReactNode;
  /** Ignored — kept for call-site compatibility during migration. */
  userId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gateMode, setGateMode] = useState<DashboardGateMode>("loading");

  useEffect(() => {
    const desktop = isDesktopRuntime();
    if (desktop) {
      setGateMode("desktop");
      return;
    }

    let active = true;

    async function resolveWebGate() {
      // Studio is session-gated; Worker passtoken is not required to enter the shell.
      if (isStudioShellPath(pathname)) {
        if (hasHqSession()) {
          setGateMode("web-owner");
          return;
        }
        const hqOk = await hqRefreshSession();
        if (!active) return;
        setGateMode(hqOk ? "web-owner" : "web-redirect");
        return;
      }

      if (hasWebOwnerSession()) {
        setGateMode("web-owner");
        return;
      }
      const restored = await restoreWebOwnerSession();
      if (!active) return;
      setGateMode(
        restored && hasWebOwnerSession() ? "web-owner" : "web-redirect",
      );
    }

    void resolveWebGate();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (gateMode !== "web-redirect") return;
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    if (pathname === "/email/inbox" || pathname === "/email") {
      router.replace(`/inbox${search}`);
    } else if (pathname === "/email/sent") {
      router.replace(`/sent${search}`);
    } else if (pathname === "/email/drafts") {
      router.replace(`/drafts${search}`);
    } else if (pathname === "/email/trash") {
      router.replace(`/trash${search}`);
    } else if (pathname === "/email/compose") {
      router.replace(`/compose${search}`);
    } else if (pathname === "/email/settings") {
      router.replace(`/mail-settings${search}`);
    } else if (isStudioShellPath(pathname)) {
      const next = `${pathname}${search}`;
      router.replace(`/studio/login?next=${encodeURIComponent(next)}`);
    } else {
      const auth = getWebTeamAuth();
      if (auth) {
        router.replace(`/inbox${search}`);
      } else {
        router.replace("/login");
      }
    }
  }, [gateMode, pathname, router]);

  if (gateMode === "loading" || gateMode === "web-redirect") {
    return <AppLoadingScreen />;
  }

  if (gateMode === "web-owner") {
    return <WebOwnerGate>{children}</WebOwnerGate>;
  }

  return (
    <DesktopShell>
      <ConsoleAppProviders>
        <EnableEmailApiDialogHost>
          <GateInner>{children}</GateInner>
        </EnableEmailApiDialogHost>
      </ConsoleAppProviders>
    </DesktopShell>
  );
}
