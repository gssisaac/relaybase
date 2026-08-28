"use client";

import { RestoreLastRoute } from "@/components/RestoreLastRoute";
import { SessionPhaseScreen } from "@/console/components/setup/SessionPhaseScreen";

/**
 * App entry. `/` is outside `(shell)`, so it used to show BootScreen for
 * every non-ready phase and never mount the unlock / setup UI. The shared
 * phase screen now renders passtoken / invited login here; last route restore
 * runs only after the session is ready. Console Touch ID is not on this path.
 */
export default function HomePage() {
  return (
    <SessionPhaseScreen>
      {() => <RestoreLastRoute userId="desktop" />}
    </SessionPhaseScreen>
  );
}
