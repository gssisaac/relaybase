"use client";

import type { CfOAuthPurpose } from "./cloudflare";
import { fetchWebCfOAuthSessionPresent } from "./web-oauth-complete";
import {
  WEB_CF_OAUTH_COMPLETE_MESSAGE,
  webOAuthStartHrefForPath,
} from "./web-oauth-paths";

export {
  WEB_CF_OAUTH_COMPLETE_MESSAGE,
  webOAuthReturnTo,
  webOAuthStartHref,
  webOAuthStartHrefForPath,
} from "./web-oauth-paths";

const POPUP_NAME = "relaybase-cf-oauth";
// Do not pass `noopener` — the popup must keep `window.opener` for postMessage.
const POPUP_FEATURES = "popup=yes,width=520,height=720";

export type WebCfOAuthPopupHandlers = {
  onComplete: () => void;
  onError?: (message: string) => void;
};

/** Open Cloudflare authorize in a new window; `onComplete` when the session cookie is set. */
export function openWebCfOAuthPopup(
  authorizeHref: string,
  handlers: WebCfOAuthPopupHandlers,
): void {
  const popup = window.open(authorizeHref, POPUP_NAME, POPUP_FEATURES);
  if (!popup) {
    window.location.href = authorizeHref;
    return;
  }

  let settled = false;
  const finish = (ok: boolean, message?: string) => {
    if (settled) return;
    settled = true;
    window.removeEventListener("message", onMessage);
    clearInterval(poll);
    if (ok) handlers.onComplete();
    else handlers.onError?.(message ?? "Cloudflare authorization was not completed.");
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string } | null;
    if (data?.type !== WEB_CF_OAUTH_COMPLETE_MESSAGE) return;
    finish(true);
  };

  window.addEventListener("message", onMessage);

  const poll = window.setInterval(() => {
    if (!popup.closed) return;
    void fetchWebCfOAuthSessionPresent().then((present) => {
      if (present) finish(true);
      else finish(false, "Authorization window was closed before Cloudflare finished.");
    });
  }, 400);
}

export async function startWebCfOAuthAuthorize(options: {
  afterAuthPath: string;
  purpose?: CfOAuthPurpose;
  onComplete?: () => void | Promise<void>;
}): Promise<void> {
  const authorizeHref = webOAuthStartHrefForPath(options.afterAuthPath, options.purpose);
  return new Promise((resolve, reject) => {
    openWebCfOAuthPopup(authorizeHref, {
      onComplete: () => {
        void (async () => {
          try {
            await options.onComplete?.();
            resolve();
          } catch (err) {
            reject(err);
          }
        })();
      },
      onError: (message) => reject(new Error(message)),
    });
  });
}
