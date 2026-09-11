import { cfApiTokenHealth } from "../desktop/bridge/cloudflare";

export type HealthTone = "ok" | "bad" | "pending" | "neutral";

export type HealthStatus = {
  tone: HealthTone;
  label: string;
  detail: string;
};

export type ConnectionHealthSnapshot = {
  cfConnected?: boolean;
  worker?: {
    ok?: boolean;
    workerUrl?: string;
    r2Configured?: boolean;
    cfApiTokenSet?: boolean;
    cfApiTokenValid?: boolean;
    d1Logs?: { configured?: boolean };
    d1Mail?: { configured?: boolean };
    d1App?: { configured?: boolean };
  } | null;
} | null;

export function checkingHealth(detail: string): HealthStatus {
  return {
    tone: "pending",
    label: "Checking…",
    detail,
  };
}

export function connectionHealthFromSnapshot(
  snapshot: ConnectionHealthSnapshot,
  options?: { pending?: boolean; hasWorkerCredentials?: boolean },
): {
  cf: HealthStatus;
  worker: HealthStatus;
  r2: HealthStatus;
  d1: HealthStatus;
} {
  const pending = options?.pending ?? false;
  const hasWorker =
    Boolean(snapshot?.worker?.workerUrl?.trim()) ||
    Boolean(options?.hasWorkerCredentials);

  const cf: HealthStatus =
    pending && !snapshot?.cfConnected
      ? checkingHealth("Probing CF_API_TOKEN on the Worker.")
      : snapshot?.cfConnected
        ? {
            tone: "ok",
            label: "Configured",
            detail:
              "CF_API_TOKEN is set on the Worker and Cloudflare accepted it. Domain, address, and DNS API calls can run. Sending uses the EMAIL binding.",
          }
        : (() => {
            const health = cfApiTokenHealth(snapshot?.worker ?? null);
            if (health.label === "Permissions need fixing") {
              return {
                tone: "bad",
                label: health.label,
                detail:
                  "CF_API_TOKEN is on the Worker, but Cloudflare rejected one or more permissions. Open Settings → Cloudflare and verify again.",
              };
            }
            return {
              tone: "bad",
              label: health.label,
              detail:
                "Add a CF_API_TOKEN secret on the Worker in Cloudflare so Relaybase can manage domains and inbox routing.",
            };
          })();

  const worker: HealthStatus =
    pending && !snapshot?.worker?.ok
      ? checkingHealth("Probing Worker connection.")
      : !hasWorker
        ? {
            tone: "bad",
            label: "Not connected",
            detail: "No Worker URL saved.",
          }
        : snapshot?.worker?.ok
          ? {
              tone: "ok",
              label: "Healthy",
              detail: "Worker reachable and owner session accepted.",
            }
          : {
              tone: "bad",
              label: "Unreachable",
              detail: "Check Worker URL, console unlock, and deploy.",
            };

  const r2: HealthStatus =
    pending && !snapshot?.worker?.r2Configured
      ? checkingHealth("Listing inbound R2 binding.")
      : !hasWorker
        ? {
            tone: "bad",
            label: "Unavailable",
            detail: "Connect a routing Worker first.",
          }
        : snapshot?.worker?.r2Configured
          ? {
              tone: "ok",
              label: "Configured",
              detail: "Inbound R2 binding works.",
            }
          : {
              tone: "bad",
              label: "Not configured",
              detail: "Bind INBOUND R2 in wrangler.toml.",
            };

  const logsOk = snapshot?.worker?.d1Logs?.configured === true;
  const searchOk = snapshot?.worker?.d1Mail?.configured === true;
  const appOk = snapshot?.worker?.d1App?.configured === true;
  const d1AnyOk = logsOk || searchOk || appOk;
  const d1: HealthStatus =
    pending && !d1AnyOk
      ? checkingHealth("Probing D1 bindings.")
      : !hasWorker
        ? {
            tone: "bad",
            label: "Unavailable",
            detail: "Connect a routing Worker first.",
          }
        : logsOk && searchOk && appOk
          ? {
              tone: "ok",
              label: "Configured",
              detail: "Logs, inbox search, and product DB bindings work.",
            }
          : logsOk && searchOk
            ? {
                tone: "ok",
                label: "Logs + search configured",
                detail: "Product DB (relaybase-db) is not bound.",
              }
            : logsOk
              ? {
                  tone: "ok",
                  label: "Logs configured",
                  detail: "Ops log is ready. Inbox search / product DB not bound.",
                }
              : searchOk
                ? {
                    tone: "ok",
                    label: "Search configured",
                    detail:
                      "Inbox search is ready. Ops log / product DB not bound.",
                  }
                : appOk
                  ? {
                      tone: "ok",
                      label: "Product DB configured",
                      detail:
                        "relaybase-db is ready. Logs / inbox search not bound.",
                    }
                  : {
                      tone: "bad",
                      label: "Not configured",
                      detail:
                        "Bind RELAYBASE_LOGS / RELAYBASE_DB in wrangler.toml.",
                    };

  return { cf, worker, r2, d1 };
}
