import type { HqAuthUser } from "@db/auth-types";
import { decryptPasstoken } from "@lib/vault/passtoken-vault";

export type WorkerOwnerSessionPayload = {
  workerUrl: string;
  mailAccessToken: string;
  mailRefreshToken: string;
  consoleRefreshToken: string;
  mailExpiresIn: number;
};

async function postWorkerJson<T>(
  workerUrl: string,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const base = workerUrl.trim().replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Worker unreachable",
      status: 502,
    };
  }

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? `Worker request failed (${res.status})`,
      status: res.status,
    };
  }
  return { ok: true, data };
}

/** Mint scoped Worker owner tokens from the cloud-stored passtoken (never returned). */
export async function mintWorkerOwnerSession(
  user: HqAuthUser,
): Promise<
  { ok: true; session: WorkerOwnerSessionPayload } | { ok: false; error: string; status: number }
> {
  if ((user.type ?? "owner") !== "owner") {
    return {
      ok: false,
      error: "Console access is only available for account owners.",
      status: 403,
    };
  }

  const workerUrl = user.workerUrl?.trim().replace(/\/$/, "") ?? "";
  if (!workerUrl) {
    return { ok: false, error: "No Worker is linked to this account.", status: 404 };
  }
  if (!user.passtokenEnc) {
    return { ok: false, error: "Worker credentials are not provisioned.", status: 404 };
  }

  let passtoken: string;
  try {
    passtoken = decryptPasstoken(user.passtokenEnc);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not read Worker credentials.",
      status: 503,
    };
  }

  const login = await postWorkerJson<{
    mailAccessToken?: string;
    mailRefreshToken?: string;
    consoleRefreshToken?: string;
    mailExpiresIn?: number;
  }>(workerUrl, "/console/login", { passtoken, label: "cloud-web" });

  if (
    !login.ok ||
    !login.data.mailAccessToken ||
    !login.data.mailRefreshToken ||
    !login.data.consoleRefreshToken
  ) {
    return {
      ok: false,
      error: login.ok ? "Worker login incomplete." : login.error,
      status: login.ok ? 502 : login.status,
    };
  }

  return {
    ok: true,
    session: {
      workerUrl,
      mailAccessToken: login.data.mailAccessToken,
      mailRefreshToken: login.data.mailRefreshToken,
      consoleRefreshToken: login.data.consoleRefreshToken,
      mailExpiresIn: login.data.mailExpiresIn ?? 600,
    },
  };
}
