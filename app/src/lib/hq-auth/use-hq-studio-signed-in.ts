"use client";

import { useEffect, useState } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge";

import {
  hqRefreshSession,
  isHqStudioSignedIn,
  subscribeHqAuth,
} from "./session";

/**
 * Web: whether Relaybase Studio (HQ Cloud) has an active session.
 * Desktop: always true (Studio uses the local app session, not HQ cookies).
 */
export function useHqStudioSignedIn(): boolean {
  const desktop = isDesktopRuntime();
  const [signedIn, setSignedIn] = useState(() =>
    desktop ? true : isHqStudioSignedIn(),
  );

  useEffect(() => {
    if (desktop) {
      setSignedIn(true);
      return;
    }
    let active = true;

    function syncFromMemory() {
      setSignedIn(isHqStudioSignedIn());
    }

    syncFromMemory();
    const unsub = subscribeHqAuth(syncFromMemory);

    void hqRefreshSession().then((ok) => {
      if (!active) return;
      setSignedIn(ok || isHqStudioSignedIn());
    });

    return () => {
      active = false;
      unsub();
    };
  }, [desktop]);

  return signedIn;
}
