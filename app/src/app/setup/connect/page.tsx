"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AccountLoginView } from "@/console/components/setup/AccountLoginView";
import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { EmailAppProviders } from "@/mail-platform/runtime";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * Already-installed / post-setup sign-in. Shows the passtoken form here.
 * After unlock, leave setup for the mailbox.
 */
export default function SetupConnectPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    if (!isDesktop) {
      if (hasWebOwnerSession()) {
        router.replace("/dashboard");
      }
      return;
    }
    store.openAlreadyInstalled();
  }, [isDesktop, store, router]);

  useEffect(() => {
    if (!isDesktop) return;
    if (store.canShowApp) {
      router.replace("/email/inbox");
    }
  }, [isDesktop, store.canShowApp, router]);

  if (!isDesktop) {
    if (hasWebOwnerSession()) {
      return (
        <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
          Opening dashboard…
        </div>
      );
    }
    return (
      <EmailAppProviders>
        <AccountLoginView />
      </EmailAppProviders>
    );
  }

  if (store.canShowApp) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening mailbox…
      </div>
    );
  }

  return <UnlockView role="owner" />;
}
