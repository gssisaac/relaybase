"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AccountLoginView } from "@/console/components/setup/AccountLoginView";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { EmailAppProviders } from "@/mail-platform/runtime";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * "I was invited" entry from the welcome choice. Desktop enters TeamLoginView
 * on `/` via the shared phase screen; web renders Account Login (team tab).
 */
export default function TeamLoginPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) {
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
      } else if (getWebTeamAuth()) {
        router.replace("/inbox");
      }
      return;
    }
    store.openInvitedLogin();
    router.replace("/");
  }, [isDesktop, router, store]);

  if (!isDesktop) {
    if (hasWebOwnerSession() || getWebTeamAuth()) {
      return null;
    }
    return (
      <EmailAppProviders>
        <AccountLoginView defaultRole="team" />
      </EmailAppProviders>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
