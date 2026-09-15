import { store } from "../../db/store";

export type WorkerSendCredentials =
  | { ok: true; workerUrl: string; apiKey: string }
  | { ok: false; error: string };

/** Resolve Worker origin + domain-scoped send key for broadcast dispatch. */
export function resolveWorkerSendCredentials(): WorkerSendCredentials {
  const account = store.read().account;
  const workerUrl = account.workerUrl?.trim().replace(/\/$/, "") ?? "";
  const envKey = process.env.CRM_WORKER_SEND_API_KEY?.trim();
  const apiKey = envKey || account.sendApiKey?.trim() || "";

  if (!workerUrl) {
    return {
      ok: false,
      error:
        "Worker URL is not configured. Save broadcast settings or PATCH /crm/account-link with workerUrl.",
    };
  }
  if (!apiKey) {
    return {
      ok: false,
      error:
        "CRM send API key is not configured. Set CRM_WORKER_SEND_API_KEY or PATCH /crm/account-link with sendApiKey (desktop syncs this before send).",
    };
  }
  return { ok: true, workerUrl, apiKey };
}
