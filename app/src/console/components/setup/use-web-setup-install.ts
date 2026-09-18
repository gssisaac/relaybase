"use client";

import { useEffect, useState } from "react";

import { isDesktopRuntime } from "@/lib/desktop/bridge/invoke";
import { fetchWebCfOAuthSessionPresent } from "@/lib/desktop/bridge/web-oauth-complete";

/**
 * True when install should use the browser pipeline (sealed OAuth cookie +
 * `/api/install/stream`), not Tauri keyring + `desktopAutoInstallWorker`.
 *
 * Always true outside Tauri. Inside Tauri, still true when the user
 * authorized via the web OAuth flow (common when the shell loads
 * `http://localhost:*` during dev).
 */
export function useWebSetupInstall(): boolean {
  const [web, setWeb] = useState(() => !isDesktopRuntime());

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let active = true;
    void fetchWebCfOAuthSessionPresent().then((present) => {
      if (!active || !present) return;
      setWeb(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return web;
}
