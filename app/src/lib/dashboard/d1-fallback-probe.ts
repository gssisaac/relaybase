/** Fallback when an older Worker omits `d1` from GET /console/connect. */

import {
  d1BindingFromPayload,
  D1_APP_DEFAULT,
  D1_MAIL_DEFAULT,
  D1_LOGS_DEFAULT,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";

export type D1ProbeResult = {
  d1Logs: D1BindingSnapshot;
  d1Mail: D1BindingSnapshot;
  /** @deprecated Renamed to d1Mail. Kept for callers being migrated. */
  d1InboxIndex: D1BindingSnapshot;
  d1App: D1BindingSnapshot;
};

/** Probe D1 via /health or legacy product routes (pre-connect-probe Workers). */
export async function probeD1WhenConnectOmits(
  base: string,
  adminToken: string,
): Promise<D1ProbeResult> {
  const headers = { Authorization: `Bearer ${adminToken}` };
  let d1Logs = { ...D1_LOGS_DEFAULT };
  let d1Mail = { ...D1_MAIL_DEFAULT };
  let d1App = { ...D1_APP_DEFAULT };

  try {
    const health = await fetch(`${base}/health`, { cache: "no-store" });
    if (health.ok) {
      const json = (await health.json().catch(() => ({}))) as {
        d1?: Parameters<typeof d1BindingFromPayload>[0];
      };
      if (json.d1) {
        const mail = d1BindingFromPayload(json.d1, "mail");
        return {
          d1Logs: d1BindingFromPayload(json.d1, "logs"),
          d1Mail: mail,
          d1InboxIndex: mail,
          d1App: d1BindingFromPayload(json.d1, "app"),
        };
      }
    }
  } catch {
    // continue with legacy probes
  }

  try {
    const ops = await fetch(`${base}/console/ops-logs?limit=1`, {
      headers,
      cache: "no-store",
    });
    if (ops.ok) {
      const json = (await ops.json().catch(() => ({}))) as {
        d1Configured?: boolean;
        summary?: { total?: number };
      };
      if (typeof json.d1Configured === "boolean") {
        d1Logs = { ...d1Logs, configured: json.d1Configured };
      } else if ((json.summary?.total ?? 0) > 0) {
        d1Logs = { ...d1Logs, configured: true };
      }
    }
  } catch {
    // continue
  }

  try {
    const domainsRes = await fetch(`${base}/console/domains`, {
      headers,
      cache: "no-store",
    });
    if (domainsRes.ok) {
      const json = (await domainsRes.json().catch(() => ({}))) as {
        domains?: { domain?: string }[];
      };
      const domain = json.domains
        ?.map((entry) => entry.domain?.trim())
        .find(Boolean);
      if (domain) {
        const search = await fetch(
          `${base}/mail/inbox/search?domain=${encodeURIComponent(domain)}&q=te&limit=1`,
          { headers, cache: "no-store" },
        );
        d1Mail = {
          ...d1Mail,
          configured: search.status !== 503,
        };
      }
      // A reachable domains list implies the product DB is configured (legacy
      // Workers read domains from KV, so this is a soft signal at best).
      d1App = { ...d1App, configured: true };
    }
  } catch {
    // continue
  }

  return { d1Logs, d1Mail, d1InboxIndex: d1Mail, d1App };
}
