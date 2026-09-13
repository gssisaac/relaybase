"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { EmailAppProviders, useMailRuntime } from "@/mail-platform/runtime";
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
import { DisableAppTabFocus } from "@/components/layout/DisableAppTabFocus";
import { AppHotkeys } from "@/components/layout/AppHotkeys";
import { UserSidebar } from "@/components/layout/UserSidebar";

function WebMailShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useMailRuntime();
  const isSignIn = pathname === "/sign-in";
  const isEmailSettings =
    pathname === "/mail-settings" ||
    pathname.startsWith("/mail-settings?") ||
    pathname === "/email/settings" ||
    pathname.startsWith("/email/settings?");

  useEffect(() => {
    if (session.ready && !session.identity && !isSignIn) {
      router.replace("/sign-in");
    }
  }, [session.ready, session.identity, isSignIn, router]);

  if (isSignIn) {
    return <>{children}</>;
  }

  if (!session.ready) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session.identity) {
    return null;
  }

  const userId = session.identity.accountEmail;

  return (
    <SessionProvider userId={userId}>
      <DomainProvider>
        <SendingHealthProvider>
          <MailAccountsProvider>
            <SenderIconProvider>
              <EmailMailboxProvider>
                <EmailCommandRuntimeProvider>
                  <DisableAppTabFocus />
                  <div className="flex h-svh overflow-hidden bg-background">
                    {isEmailSettings ? null : (
                      <Suspense
                        fallback={
                          <aside className="h-full w-56 shrink-0 border-r border-sidebar-border bg-sidebar" />
                        }
                      >
                        <UserSidebar teamMode />
                      </Suspense>
                    )}
                    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      {children}
                    </main>
                  </div>
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

/**
 * Email app layout — web-only mail client.
 *
 * No console gate, no desktop shell, no Touch ID. Just the mail runtime
 * + the mail pages. Login is handled by `/sign-in` within this group.
 */
export default function EmailAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EmailAppProviders>
      <WebMailShellInner>{children}</WebMailShellInner>
    </EmailAppProviders>
  );
}
