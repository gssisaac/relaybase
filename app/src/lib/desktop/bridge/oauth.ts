import type { DesktopCredentials } from "./credentials";
import { invoke, isDesktopRuntime } from "./invoke";

// --- Cloudflare OAuth (install token) ---
// The install token is obtained via a CF OAuth authorization-code + refresh
// flow whose callback lives on console.relaybase.xyz. The desktop opens the
// authorize URL in the system browser; the console exchanges the code and
// redirects the browser to a `relaybase://oauth/callback` deep link carrying
// the tokens. The frontend listens for that deep link (see
// `listenCfOAuthDeepLink`) and hands the tokens to `complete_cf_oauth`,
// which stores them in Tauri process memory only. Refresh is handled
// transparently by the Rust side before any wrangler/CF-API call.

export async function desktopStartCfOAuth(): Promise<{
  authorizeUrl: string;
  state: string;
}> {
  return invoke("start_cf_oauth");
}

export type CfOAuthDeepLinkCallback = {
  state: string;
  code: string;
};

/** Parse a `relaybase://oauth/callback?...` URL into the code + state payload. */
export function parseCfOAuthDeepLink(url: string): CfOAuthDeepLinkCallback | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "relaybase:" || u.host !== "oauth" || u.pathname !== "/callback") {
      return null;
    }
    const state = u.searchParams.get("state") ?? "";
    const code = u.searchParams.get("code") ?? "";
    if (!state || !code) return null;
    return { state, code };
  } catch {
    return null;
  }
}

/**
 * Subscribe to the CF OAuth deep link. Calls `handler` with the parsed
 * { state, code } whenever a `relaybase://oauth/callback` URL opens the app
 * (either on launch via `getCurrent`, or while running via `onOpenUrl`).
 * Returns an unsubscribe function (no-op outside Tauri).
 */
export async function listenCfOAuthDeepLink(
  handler: (cb: CfOAuthDeepLinkCallback) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op outside Tauri */
    };
  }
  try {
    const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
    const dispatch = (urls: string[] | null) => {
      if (!urls) return;
      for (const u of urls) {
        const parsed = parseCfOAuthDeepLink(u);
        if (parsed) handler(parsed);
      }
    };
    // App may have been launched by the deep link (cold start).
    dispatch(await getCurrent());
    // Subsequent links while running.
    const unlisten = await onOpenUrl(dispatch);
    return () => {
      try {
        unlisten();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {
      /* plugin not available */
    };
  }
}

/** Complete the CF OAuth flow from a deep-link payload: validate state and
 * exchange the code (the desktop holds the PKCE verifier). Returns the
 * updated credentials. */
export async function desktopCompleteCfOAuth(
  cb: CfOAuthDeepLinkCallback,
): Promise<DesktopCredentials> {
  return invoke("complete_cf_oauth", {
    state: cb.state,
    code: cb.code,
  });
}

/**
 * Listen for Rust-completed CF OAuth (loopback http://127.0.0.1:32831 or
 * `relaybase://` deep link). Prefer this over `listenCfOAuthDeepLink` — the
 * desktop completes the exchange itself so Settings does not have to.
 */
export async function listenCfOAuthResult(handler: {
  onComplete: () => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op outside Tauri */
    };
  }
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unOk = await listen<{ ok?: boolean }>("cf-oauth-complete", () => {
      handler.onComplete();
    });
    const unErr = await listen<{ error?: string }>("cf-oauth-error", (e) => {
      handler.onError(
        typeof e.payload?.error === "string" && e.payload.error.trim()
          ? e.payload.error
          : "Cloudflare connection failed",
      );
    });
    return () => {
      const settle = (unlisten: () => void) => {
        try {
          void Promise.resolve(unlisten()).catch(() => {
            /* already removed — Tauri throws if the event id is gone */
          });
        } catch {
          /* already removed */
        }
      };
      settle(unOk);
      settle(unErr);
    };
  } catch {
    return () => {
      /* plugin not available */
    };
  }
}

/** Force a refresh of the OAuth access token (rarely needed; the Rust side
 * refreshes automatically before wrangler/CF-API calls). Returns the updated
 * credentials. */
export async function desktopRefreshInstallToken(): Promise<DesktopCredentials> {
  return invoke("refresh_install_token");
}
