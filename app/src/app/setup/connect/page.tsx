"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { UnlockView } from "@/console/components/setup/UnlockView";
import { useAppSession } from "@/lib/desktop/app-session";

/**
 * Already-installed / post-setup sign-in. Shows the passtoken form here.
 * After unlock, leave setup for the mailbox.
 */
export default function SetupConnectPage() {
  const router = useRouter();
  const store = useAppSession();

  useEffect(() => {
    store.openAlreadyInstalled();
  }, [store]);

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
