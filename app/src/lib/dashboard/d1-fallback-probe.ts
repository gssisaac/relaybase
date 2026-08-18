/** Fallback when an older Worker omits `d1` from GET /console/connect. */

import {
  d1BindingFromPayload,
  D1_INBOX_INDEX_DEFAULT,
  D1_LOGS_DEFAULT,
  type D1BindingSnapshot,
} from "@/lib/dashboard/d1-binding-status";

export type D1ProbeResult = {
  d1Logs: D1BindingSnapshot;
  d1InboxIndex: D1BindingSnapshot;
};

/** Probe D1 via /health or legacy product routes (pre-connect-probe Workers). */
export async function probeD1WhenConnectOmits(
  base: string,
  adminToken: string,
): Promise<D1ProbeResult> {
  const headers = { Authorization: `Bearer ${adminToken}` };
  let d1Logs = { ...D1_LOGS_DEFAULT };
  let d1InboxIndex = { ...D1_INBOX_INDEX_DEFAULT };

  try {
    const health = await fetch(`${base}/health`, { cache: "no-store" });
    if (health.ok) {
      const json = (await health.json().catch(() => ({}))) as {
        d1?: Parameters<typeof d1BindingFromPayload>[0];
      };
      if (json.d1) {
        return {
          d1Logs: d1BindingFromPayload(json.d1, "logs"),
          d1InboxIndex: d1BindingFromPayload(json.d1, "inboxIndex"),
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
        d1InboxIndex = {
          ...d1InboxIndex,
          configured: search.status !== 503,
        };
      }
    }
  } catch {
    // continue
  }

  return { d1Logs, d1InboxIndex };
}
