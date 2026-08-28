import {
  WORKER_INSTALL_ZIP_URL,
  cloudflareR2DashboardUrl,
  isCloudflareAuthExpired,
} from "./cloudflare";
import { formatDesktopError } from "./invoke";

export type DesktopErrorLink = {
  label: string;
  href: string;
};

export type DesktopErrorHelp = {
  title: string;
  /** Short human-readable explanation — never raw API JSON. */
  detail: string;
  fix: string;
  links?: DesktopErrorLink[];
  /** Running Worker version vs hosted latest, when the script is stale. */
  versions?: { current: string; latest: string };
  /** Cloudflare API token scopes to grant when the error is auth/permission related. */
  permissions?: readonly string[];
};

function stripRawApiNoise(raw: string): string {
  // Drop Cloudflare-style JSON error arrays / payloads from user-facing text.
  return raw
    .replace(/:\s*\[\{[\s\S]*\}\]\s*$/g, "")
    .replace(/\{[\s\S]*"code"\s*:\s*\d+[\s\S]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCfWorkerCode(raw: string): string | null {
  const plain = raw.match(/error code:\s*(\d{3,5})/i);
  if (plain?.[1]) return plain[1];
  const json = raw.match(/"code"\s*:\s*(\d{3,5})/i);
  if (json?.[1]) return json[1];
  return null;
}

function accountIdFromCfError(raw: string): string {
  const dash = raw.match(/dash\.cloudflare\.com\/([a-f0-9]{32})(?:\/r2)?/i);
  if (dash?.[1]) return dash[1];
  const accounts = raw.match(/\/accounts\/([a-f0-9]{32})\//i);
  return accounts?.[1] ?? "";
}

export function oauthAuthorizationIncompleteHelp(
  reason: "timeout" | "cancelled" = "timeout",
): DesktopErrorHelp {
  return {
    title: "Authorization didn't complete",
    detail:
      reason === "cancelled"
        ? "Cloudflare authorization was cancelled before Relaybase could connect."
        : "Cloudflare authorization timed out. The browser window may still be open — close it and try again.",
    fix: "Click Authorize with Cloudflare to start again.",
  };
}

const CF_WORKER_CODE_HELP: Record<
  string,
  { title: string; detail: string; fix: string }
> = {
  "1101": {
    title: "Worker threw an exception (Cloudflare 1101)",
    detail:
      "The Worker started, then crashed with a JavaScript exception. This is a runtime error in the uploaded script — not a version label.",
    fix: "Open Cloudflare → Workers → relaybase-api → Logs for the stack. If you just deployed, wait a few seconds and Try again.",
  },
  "1102": {
    title: "Worker hit a CPU limit (Cloudflare 1102)",
    detail:
      "This request used more CPU time than Cloudflare allows for the Worker.",
    fix: "Retry once. If it keeps happening, the uploaded worker.js may be too heavy for this request.",
  },
  "1103": {
    title: "Workers runtime blocked this account (Cloudflare 1103)",
    detail:
      "Cloudflare is refusing to run Workers on this account until Support reviews it.",
    fix: "Contact Cloudflare Support from the dashboard. Retrying install will not clear 1103.",
  },
  "1104": {
    title: "Cloudflare cancelled the Worker (error 1104)",
    detail:
      "The Workers runtime cancelled this request while starting or running the isolate. This often happens right after a deploy, or if startup is too slow. It is not a Relaybase “old version” error.",
    fix: "Wait a few seconds and Try again. If 1104 repeats after a current worker.js upload, open Workers → Logs and Cloudflare Status.",
  },
  "1027": {
    title: "Workers free-tier daily limit (Cloudflare 1027)",
    detail: "This Cloudflare account used up today’s free Workers requests.",
    fix: "Wait for the daily reset, or upgrade the Workers plan, then Try again.",
  },
  "1042": {
    title: "Worker-to-Worker fetch blocked (Cloudflare 1042)",
    detail:
      "A same-zone Worker fetch was blocked. This can appear right after deploy.",
    fix: "Retry. If it persists, wait for the Worker URL to finish propagating.",
  },
  "1015": {
    title: "Cloudflare rate limited the request (1015)",
    detail: "Too many requests hit this Worker in a short window.",
    fix: "Wait a moment, then Try again.",
  },
};

/** Worker-update OAuth / URL check. Never attach install-ZIP links. */
export function explainWorkerUpdateTargetError(err: unknown): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();
  const saved = raw.match(/Saved Worker:\s*(\S+)/i)?.[1];
  const next = raw.match(/This login would update:\s*(\S+)/i)?.[1];
  if (lower.includes("worker_url_account_mismatch") || (saved && next && saved !== next)) {
    return {
      title: "Wrong Cloudflare account",
      detail:
        saved && next
          ? `Your Relaybase Worker is ${saved}. This login would update ${next}.`
          : "This Cloudflare login belongs to a different account than your saved Worker.",
      fix: "Authorize again and pick the Cloudflare account that owns your Worker. Nothing was uploaded.",
    };
  }
  if (lower.includes("authorize with cloudflare first")) {
    return {
      title: "Cloudflare account not ready",
      detail:
        "Authorization finished, but Relaybase could not read which Cloudflare account you picked.",
      fix: "Authorize again and stay on the Cloudflare account that owns your saved Worker.",
    };
  }
  if (
    lower.includes("no workers.dev subdomain") ||
    lower.includes("has no workers.dev")
  ) {
    return {
      title: "Wrong Cloudflare account",
      detail:
        "This login has no workers.dev subdomain, so it is not the account that owns your saved Worker.",
      fix: "Authorize again and pick the Cloudflare account that owns your Worker. Nothing was uploaded.",
    };
  }
  const cleaned = stripRawApiNoise(raw);
  return {
    title: "Could not confirm Worker URL",
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Relaybase could not compare this Cloudflare login with your saved Worker URL.",
    fix: "Authorize again and pick the Cloudflare account that owns your Worker. Nothing was uploaded.",
  };
}

/** Map common desktop failures to a short title + what to do next. */
export function explainDesktopError(
  err: unknown,
  fallbackTitle = "Something went wrong",
  opts?: { accountId?: string },
): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();
  const cfCode = extractCfWorkerCode(raw);
  if (cfCode) {
    return (
      CF_WORKER_CODE_HELP[cfCode] ?? {
        title: `Cloudflare Worker error ${cfCode}`,
        detail: `Cloudflare returned error code ${cfCode}. This is a Workers runtime / edge error, not a Relaybase version label.`,
        fix: "Wait a few seconds and Try again. If it repeats, open Cloudflare → Workers → relaybase-api → Logs.",
      }
    );
  }
  const installLinks: DesktopErrorLink[] = [
    { label: "Download Worker install ZIP", href: WORKER_INSTALL_ZIP_URL },
    { label: "Open install setup", href: "/setup/install" },
  ];

  if (
    lower.includes("does not support zone listing") ||
    lower.includes("check for a worker update")
  ) {
    return {
      title: "Worker update required",
      detail:
        "This Worker is missing the zone list API. Secrets like CF_ACCOUNT_ID are fine — the running script version does not match the latest.",
      fix: "Compare versions below, then open Worker update in Settings.",
      links: [
        { label: "Open Worker update", href: "/settings/worker/update" },
      ],
    };
  }

  if (
    lower.includes("~/.relaybase") ||
    lower.includes(".relaybase") ||
    lower.includes("credentials.json") ||
    lower.includes("could not resolve home") ||
    lower.includes("failed to create") ||
    lower.includes("failed to write credentials")
  ) {
    return {
      title: "Could not save credentials on this Mac",
      detail: stripRawApiNoise(raw) || "Could not create or write ~/.relaybase/credentials.json.",
      fix: "Relaybase creates ~/.relaybase automatically. Ensure your home folder is writable, then Verify again. To reset, delete ~/.relaybase/credentials.json.",
    };
  }

  if (lower.includes("worker_url_account_mismatch")) {
    return explainWorkerUpdateTargetError(err);
  }

  if (
    fallbackTitle.toLowerCase().includes("confirm worker") ||
    lower.includes("authorize with cloudflare first")
  ) {
    return explainWorkerUpdateTargetError(err);
  }

  if (
    lower.includes("db_already_initialized") ||
    lower.includes("cannot clear existing data")
  ) {
    return {
      title: "Database already has data",
      detail:
        "init-db only runs on empty D1. Existing product tables were left unchanged.",
      fix: "To apply pending schema only, use migrate-db. To start empty, delete the D1 databases in Cloudflare, create new ones, then init-db.",
    };
  }

  if (
    lower.includes("admin token was rejected") ||
    lower.includes("unauthorized") ||
    lower.includes("status: 401") ||
    lower.includes("(401)")
  ) {
    return {
      title: "Worker rejected the install request",
      detail:
        "The Worker URL responded, but init-db or migrate-db returned 401 Unauthorized. This usually means the uploaded worker.js is still on the old ADMIN_TOKEN auth model, or an owner is already configured and the install cannot use AUTH_PEPPER bootstrap.",
      fix: "Deploy the latest Worker install ZIP from relaybase.xyz, then Try again with Skip on existing Worker and D1 (do not Rollback or Reinstall). If you already completed owner setup, sign in with your passtoken or use Setup → I forgot my passtoken.",
      links: installLinks,
    };
  }

  if (
    lower.includes("could not reach worker") ||
    lower.includes("error sending request") ||
    lower.includes("timed out") ||
    lower.includes("dns")
  ) {
    return {
      title: "Could not reach your Worker",
      detail:
        "This Mac could not call the Worker URL. Check the URL, that deploy finished, and your network.",
      fix: "Open the URL + `/health` in a browser. If that fails, redeploy from the install ZIP.",
      links: installLinks,
    };
  }

  if (
    lower.includes("no such table") &&
    lower.includes("owner_config")
  ) {
    return {
      title: "Worker ran before database setup",
      detail:
        "The uploaded Worker queried owner_config before init-db created that table. A current worker.js skips that on an empty D1.",
      fix: "Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again. Rollback does not replace worker.js.",
    };
  }

  if (
    lower.includes("no d1bound") ||
    lower.includes("too old to initialize") ||
    (lower.includes("stale") && lower.includes("worker.js"))
  ) {
    return {
      title: "Installer does not have a current Worker script",
      detail:
        "The hosted install ZIP is missing d1Bound (current /health). Rolling back Cloudflare resources does not replace the package on this Mac.",
      fix: "Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again.",
    };
  }

  if (
    lower.includes("does not look like a relaybase") ||
    lower.includes("not with a relaybase connect") ||
    lower.includes("connect check failed")
  ) {
    return {
      title: "Not a Relaybase Worker",
      detail:
        "The URL is reachable but did not return a Relaybase connect response. The hosted Worker crashes on empty D1 while checking admin auth.",
      fix: "Click Try again to re-upload the Worker. Verify now only retries connect — it does not replace worker.js.",
    };
  }

  if (lower.includes("worker url")) {
    return {
      title: "Worker URL looks invalid",
      detail: stripRawApiNoise(raw) || "Enter your workers.dev HTTPS URL.",
      fix: "Example: https://relaybase-api.<your-subdomain>.workers.dev",
      links: installLinks,
    };
  }

  if (isCloudflareAuthExpired(err)) {
    return {
      title: "Cloudflare authorization expired",
      detail:
        "Relaybase is no longer connected to your Cloudflare account. This connection is only kept while the app is open, and Cloudflare may also expire it.",
      fix: "Enable the email API on your Worker, then retry.",
    };
  }

  if (
    lower.includes("r2_subscription_required") ||
    lower.includes("10042") ||
    lower.includes("enable r2") ||
    (lower.includes("r2") && lower.includes("subscription"))
  ) {
    const href = cloudflareR2DashboardUrl(
      accountIdFromCfError(raw) || opts?.accountId?.trim() || "",
    );
    return {
      title: "Cloudflare R2 is not active",
      detail:
        "This Cloudflare account has no R2 product. Cloudflare sometimes removes the unused $0 subscription a few days after first use. Mail cannot be stored until R2 is added back.",
      fix: "Open R2 in the Cloudflare dashboard, add R2 to the account if prompted, then return here and Try again.",
      links: [{ label: "Open R2 in Cloudflare", href }],
    };
  }

  if (lower.includes("install_cancelled")) {
    return {
      title: "Installation stopped",
      detail:
        "Install was stopped. Resources created in this run were removed from your Cloudflare account.",
      fix: "Click Try again to start a new install, or go back to setup.",
    };
  }

  const cleaned = stripRawApiNoise(raw);

  if (
    lower.includes("migrate-db") ||
    lower.includes("already exists") ||
    lower.includes("d1_error")
  ) {
    return {
      title: "Database migration failed",
      detail:
        cleaned && cleaned.length < 280
          ? cleaned
          : "The Worker was uploaded. migrate-db could not apply a pending file.",
      fix: "The script is on Cloudflare. Retry migrate-db. If it repeats, check D1 d1_migrations against the schema — do not re-authorize.",
    };
  }

  if (lower.includes("authorize") || lower.includes("oauth")) {
    return {
      title: fallbackTitle,
      detail:
        cleaned && cleaned.length < 220
          ? cleaned
          : "Relaybase could not finish this Cloudflare authorization step.",
      fix: "Authorize again and pick the Cloudflare account that owns your Worker. Nothing was uploaded.",
    };
  }

  if (
    fallbackTitle.toLowerCase().includes("existing resources") ||
    lower.includes("403") ||
    lower.includes("forbidden")
  ) {
    return {
      title: fallbackTitle,
      detail:
        cleaned && cleaned.length < 280
          ? cleaned
          : "Cloudflare refused the resource check with this install token.",
      fix: "Tap Try again. If it keeps failing, go back and Authorize Cloudflare again so Relaybase can list Workers, R2, and D1.",
    };
  }

  return {
    title: fallbackTitle,
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Something unexpected happened while connecting to your Worker.",
    fix: "Check the Worker URL and admin token from your Wrangler deploy, then try again.",
    links: installLinks,
  };
}

/**
 * Error explainer for the Cloudflare OAuth (install token) flow. Intentionally
 * does NOT attach the legacy manual-install links ("Download Worker install
 * ZIP", "Open install setup") or the legacy ADMIN_TOKEN install messaging —
 * those belong to the deprecated paste-a-token flow, not OAuth. Produces a
 * clean, OAuth-specific message.
 */
export function explainCfOAuthError(
  err: unknown,
  fallbackTitle = "Cloudflare connection failed",
): DesktopErrorHelp {
  const raw = formatDesktopError(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes("could not reach relaybase console") ||
    lower.includes("could not reach the relaybase console") ||
    lower.includes("error sending request") ||
    lower.includes("timed out") ||
    lower.includes("dns")
  ) {
    return {
      title: "Could not reach the Relaybase console",
      detail:
        "Relaybase could not contact console.relaybase.xyz to start the Cloudflare connection. Check your internet connection and try again.",
      fix: "If the problem persists, the console may be briefly unavailable.",
    };
  }

  if (
    lower.includes("oauth config") ||
    lower.includes("clientid") ||
    lower.includes("client secret") ||
    lower.includes("oauth client not configured")
  ) {
    return {
      title: "Cloudflare OAuth isn't configured yet",
      detail:
        "The Relaybase console hasn't been set up with a Cloudflare OAuth client. Connecting won't work until that's done.",
      fix: "This is usually resolved shortly after a Relaybase update. Try again later, or contact Relaybase if it persists.",
    };
  }

  if (
    lower.includes("32831") ||
    lower.includes("already in use") ||
    lower.includes("callback port")
  ) {
    return {
      title: "Another Relaybase is using the callback port",
      detail:
        "Cloudflare returns to 127.0.0.1:32831. The installed Relaybase.app (or another window) is already listening there, so this window never sees the authorization.",
      fix: "Quit Relaybase.app in Applications, then click Authorize again in this window.",
    };
  }

  if (lower.includes("worker_url_account_mismatch")) {
    return explainWorkerUpdateTargetError(err);
  }

  if (lower.includes("state does not match") || lower.includes("oauth state")) {
    return {
      title: "Cloudflare connection didn't complete",
      detail:
        "The Cloudflare callback didn't match the connection you started here. This can happen if you have an old link open.",
      fix: "Click Connect with Cloudflare again and approve in the browser window that opens.",
    };
  }

  if (
    lower.includes("access_denied") ||
    lower.includes("access denied") ||
    lower.includes("user denied") ||
    lower.includes("authorization denied")
  ) {
    return oauthAuthorizationIncompleteHelp("cancelled");
  }

  if (lower.includes("missing tokens") || lower.includes("token exchange failed")) {
    return {
      title: "Cloudflare didn't return a token",
      detail:
        "Cloudflare authorized the request but didn't return an access token to Relaybase.",
      fix: "Try Connect with Cloudflare again. If it keeps happening, the OAuth client may be misconfigured on the Relaybase side.",
    };
  }

  const cleaned = stripRawApiNoise(raw);
  return {
    title: fallbackTitle,
    detail:
      cleaned && cleaned.length < 220
        ? cleaned
        : "Something went wrong while connecting to Cloudflare.",
    fix: "Click Connect with Cloudflare again. If it keeps happening, try reconnecting from a clean state.",
  };
}
