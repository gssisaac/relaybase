"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { AccountLoginView } from "@/console/components/setup/AccountLoginView";
import { useAppSession } from "@/lib/desktop/app-session";
import { restoreWebOwnerSession } from "@/lib/desktop/auth";
import { isDesktopRuntime } from "@/lib/desktop/bridge";
import { EmailAppProviders } from "@/mail-platform/runtime";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * Desktop: "I was invited" trampoline — enters TeamLoginView on `/` via the
 * shared phase screen.
 * Web: the unauthenticated entry (`https://www.relaybase.email/login`) —
 * Account Login with the Owner tab selected. Already signed in (or a
 * restorable owner session in this tab) bounces to the dashboard / inbox.
 */
export default function LoginPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();
  const [webShowsForm, setWebShowsForm] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
        return;
      }
      if (getWebTeamAuth()) {
        router.replace("/inbox");
        return;
      }
      let active = true;
      void restoreWebOwnerSession().then((restored) => {
        if (!active) return;
        if (restored && hasWebOwnerSession()) {
          router.replace("/dashboard");
        } else {
          setWebShowsForm(true);
        }
      });
      return () => {
        active = false;
      };
    }
    store.openInvitedLogin();
    router.replace("/");
  }, [isDesktop, router, store]);

  if (!isDesktop) {
    if (!webShowsForm) {
      return <AppLoadingScreen />;
    }
    return (
      <EmailAppProviders>
        <AccountLoginView defaultRole="owner" />
      </EmailAppProviders>
    );
  }

  return (
    <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
      Opening…
    </div>
  );
}
