import type { EmailSenderConfig } from "./config";

export type AuthTokenView = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

export type AuthTokenRecord = AuthTokenView & {
  token: string;
};

type WorkerListResponse = {
  tokens: AuthTokenView[];
};

type WorkerCreateResponse = {
  id: string;
  token: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  createdAt: string;
};

async function workerAuthTokensFetch<T>(
  _cfg: EmailSenderConfig,
  _path: string,
  _init?: RequestInit,
): Promise<T> {
  throw new Error(
    "HQ admin no longer authenticates to the product Worker. Use the desktop app.",
  );
}

export async function listAuthTokensFromWorker(
  cfg: EmailSenderConfig,
): Promise<AuthTokenView[]> {
  const data = await workerAuthTokensFetch<WorkerListResponse>(cfg, "");
  return data.tokens ?? [];
}

export async function issueAuthTokenViaWorker(
  cfg: EmailSenderConfig,
  params: { label?: string; productId?: string },
): Promise<AuthTokenRecord> {
  const data = await workerAuthTokensFetch<WorkerCreateResponse>(cfg, "", {
    method: "POST",
    body: JSON.stringify({
      label: params.label,
      productId: params.productId,
    }),
  });
  return {
    id: data.id,
    label: data.label,
    productId: data.productId,
    tokenPrefix: data.tokenPrefix,
    createdAt: data.createdAt,
    token: data.token,
  };
}

export async function revokeAuthTokenViaWorker(
  cfg: EmailSenderConfig,
  id: string,
): Promise<boolean> {
  try {
    await workerAuthTokensFetch<{ ok: boolean }>(cfg, `/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("(404)") || message.includes("not found")) {
      return false;
    }
    throw error;
  }
}

export async function findAuthTokenViaWorker(
  cfg: EmailSenderConfig,
  token: string,
): Promise<AuthTokenView | null> {
  const data = await workerAuthTokensFetch<{ valid: boolean; token?: AuthTokenView }>(
    cfg,
    "/verify",
    {
      method: "POST",
      body: JSON.stringify({ token }),
    },
  );
  if (!data.valid || !data.token) return null;
  return data.token;
}
