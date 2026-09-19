"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AppShellFrame } from "@/components/layout/app-shell-nav";
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { AppHotkeys } from "@/components/layout/AppHotkeys";
import { WebConsoleAppProviders } from "@/mail-platform/runtime";
import { SessionProvider } from "@/lib/dashboard/shared/ProductContext";
import { DomainProvider } from "@/lib/dashboard/DomainContext";
import { SendingHealthProvider } from "@/lib/dashboard/SendingHealthContext";
import { MailAccountsProvider } from "@/email/components/accounts/MailAccountsContext";
import { SenderIconProvider } from "@/email/components/sender/SenderIconContext";
import { EmailMailboxProvider } from "@/email/components/mailbox/EmailMailboxContext";
import {
  EmailCommandRuntimeProvider,
  GlobalCommandPalette,
} from "@/email/commands";
import { ensureWebCloudAuth } from "@/lib/auth/cloud-worker-session";

type MailGate = "loading" | "ready" | "login" | "studio-only";

function WebMailShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<MailGate>("loading");

  const isEmailSettings =
    pathname === "/mail-settings" ||
    pathname === "/mail-settings/" ||
    pathname.startsWith("/mail-settings?") ||
    pathname.startsWith("/mail-settings/");

  useEffect(() => {
    let active = true;
    void ensureWebCloudAuth().then((result) => {
      if (!active) return;
      if (result === "login") setGate("login");
      else if (result === "studio-only") setGate("studio-only");
      else setGate("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (gate === "login") {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const next = `${pathname}${search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (gate === "studio-only") {
      router.replace("/studio/dashboard");
    }
  }, [gate, pathname, router]);

  if (gate !== "ready") {
    return <AppLoadingScreen />;
  }

  return (
    <SessionProvider userId="web-owner">
      <DomainProvider>
        <SendingHealthProvider>
          <MailAccountsProvider>
            <SenderIconProvider>
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <AppShellFrame teamMode hideSidebar={isEmailSettings}>
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

/** Web mail routes (`/inbox`, `/sent`, …) — cloud account + server-minted Worker session. */
export default function EmailAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebConsoleAppProviders>
      <WebMailShellInner>{children}</WebMailShellInner>
    </WebConsoleAppProviders>
  );
}
