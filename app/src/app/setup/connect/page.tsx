"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * Already-installed / post-setup sign-in. Shows the passtoken form here.
 * After unlock, leave setup for the mailbox.
 */
export default function SetupConnectPage() {
  const router = useRouter();
  const store = useAppSession();

  useEffect(() => {
    if (!isDesktopRuntime()) {
      router.replace(hasWebOwnerSession() ? "/dashboard" : "/sign-in");
      return;
    }
    store.openAlreadyInstalled();
  }, [store, router]);

  useEffect(() => {
    if (store.canShowApp) {
      router.replace("/email/inbox");
    }
  }, [store.canShowApp, router]);

  if (store.canShowApp) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening mailbox…
      </div>
    );
  }

  return <UnlockView role="owner" />;
}
