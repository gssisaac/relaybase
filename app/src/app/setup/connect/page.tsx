"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/app-session";
import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { getWebTeamAuth } from "@/mail-platform/session/email-session";
import { RECOVER_ADMIN_PATH } from "@/lib/navigation/recover-admin";
import { hasWebOwnerSession } from "@/mail-platform/session/web-owner-session";

/**
 * Desktop: already-installed passtoken unlock (`UnlockView`).
 * Web: do not render login here — the Owner/Teammate form lives at `/login`.
 */
export default function SetupConnectPage() {
  const router = useRouter();
  const store = useAppSession();
  const isDesktop = isDesktopRuntime();

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
      router.replace(`/worker/login${window.location.search}`);
      return;
    }
    if (store.phase.kind === "ownerRecover") {
      router.replace(RECOVER_ADMIN_PATH);
      return;
    }
    store.openAlreadyInstalled();
  }, [isDesktop, store, store.phase.kind, router]);

  useEffect(() => {
    if (!isDesktop) return;
    if (store.canShowApp) {
      router.replace("/email/inbox");
    }
  }, [isDesktop, store.canShowApp, router]);

  if (!isDesktop) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        Opening…
      </div>
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
