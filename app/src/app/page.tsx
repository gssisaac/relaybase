"use client";

import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { useAppSession } from "@/lib/desktop/AppSessionContext";
import { BootScreen } from "@/console/components/setup/BootScreen";

/**
 * App entry. The last-route restore used to run before the unlock gate, so
 * the window would redirect into the shell (and then show Touch ID) — adding
 * a hop. Now we wait for the session store to reach a "ready" phase before
 * restoring the last email/dashboard route; otherwise we show the boot
 * screen and let the gate drive unlock / setup.
 */
export default function HomePage() {
  const store = useAppSession();
  if (!store.canShowApp) {
    return <BootScreen />;
  }
  return <RestoreLastRoute userId="desktop" />;
}
