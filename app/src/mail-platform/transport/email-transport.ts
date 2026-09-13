/**
 * Email-mode transport — web-only mail client.
 *
 * Calls the customer Worker's `/mobile/*` routes directly from the browser
 * with `Authorization: Bearer <mobilePassword>` and `X-Account-Email`.
 * The session holds the password in memory (short-term; a same-origin BFF
 * can replace this later without changing the port — see PLAN.md §2).
 */
import type { MailTransport, EmailIdentity } from "../types";
import { mapEmailApiToMobile } from "./map-email-mobile";

const WEBKIT_PATTERN_ERR = /string did not match the expected pattern/i;
const WEBKIT_LOAD_FAILED_ERR = /^(load failed|failed to fetch)$/i;

export const API_UNAVAILABLE =
  "Live API unavailable. Cached data is shown when available.";
export const API_NOT_WIRED = "This feature is not available in email mode.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type EmailTransportOptions = {
  /** Returns the current identity; null when logged out. */
  getIdentity: () => EmailIdentity | null;
  /** Returns the current mobile password (memory only). */
  getMobilePassword: () => string | null;
};

export function createEmailTransport(
  options: EmailTransportOptions,
): MailTransport {
  const { getIdentity, getMobilePassword } = options;

  async function fetchMobile(
    workerPath: string,
    init?: RequestInit,
  ): Promise<Response> {
    const identity = getIdentity();
    const password = getMobilePassword();
    if (!identity || !password) {
      throw new Error("Not signed in. Sign in with your account password.");
    }
    const base = identity.workerUrl.replace(/\/$/, "");
    const url = `${base}${workerPath.startsWith("/") ? workerPath : `/${workerPath}`}`;

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${password}`);
    headers.set("X-Account-Email", identity.accountEmail);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    try {
      return await fetch(url, { ...init, headers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (WEBKIT_PATTERN_ERR.test(msg) || WEBKIT_LOAD_FAILED_ERR.test(msg.trim())) {
        throw new Error(API_UNAVAILABLE);
      }
      throw new Error(`Worker request failed: ${msg}`);
    }
  }

  return {
    get isWorkerBacked() {
      return getIdentity() !== null;
    },
    async fetch(path: string, init?: RequestInit): Promise<Response> {
      const mapped = mapEmailApiToMobile(path);
      if (mapped === "empty-sent") {
        return jsonResponse({ sent: [], items: [] });
      }
      if (mapped) {
        let workerPath = mapped;
        const method = (init?.method ?? "GET").toUpperCase();

        // Notifications ack mapping
        if (
          method === "POST" &&
          workerPath.startsWith("/mobile/notifications") &&
          !workerPath.startsWith("/mobile/notifications/ack")
        ) {
          const q = workerPath.includes("?")
            ? workerPath.slice(workerPath.indexOf("?"))
            : "";
          workerPath = `/mobile/notifications/ack${q}`;
        }

        // Config normalization for EmailMailboxStore
        if (workerPath.startsWith("/mobile/config")) {
          try {
            const res = await fetchMobile(workerPath, init);
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            const identity = getIdentity();
            return jsonResponse({
              relaybaseConfigured: true,
              ...data,
              email: identity?.accountEmail ?? data.email,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(msg);
          }
        }

        return fetchMobile(workerPath, init);
      }
      // Not a mail path, or console-only route in email mode.
      if (path.startsWith("/api/email")) {
        throw new Error(API_NOT_WIRED);
      }
      // Non-email API path — plain fetch (relative to current origin).
      const local = path.startsWith("/") ? path : `/${path}`;
      try {
        return await fetch(local, init);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (WEBKIT_PATTERN_ERR.test(msg) || WEBKIT_LOAD_FAILED_ERR.test(msg.trim())) {
          throw new Error(API_UNAVAILABLE);
        }
        throw new Error(`Request failed: ${msg}`);
      }
    },
  };
}
