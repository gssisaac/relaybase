import { desktopAwareFetch, readResponseJson } from "@/lib/desktop/api";

export type CfVerifiedDestinationAddress = {
  id: string;
  email: string;
  verified: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
};

export class VerifiedDestinationApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function qs(accountId?: string): string {
  const pin = accountId?.trim();
  return pin ? `?accountId=${encodeURIComponent(pin)}` : "";
}

async function parseError(res: Response): Promise<VerifiedDestinationApiError> {
  const body = await readResponseJson<{ error?: string; code?: string }>(res).catch(
    () => ({ error: undefined, code: undefined }),
  );
  return new VerifiedDestinationApiError(
    res.status,
    body.error ?? `Request failed (${res.status})`,
    body.code,
  );
}

export const verifiedDestinationApi = {
  async list(accountId?: string): Promise<CfVerifiedDestinationAddress[]> {
    const res = await desktopAwareFetch(
      `/api/email/email-routing/addresses${qs(accountId)}`,
    );
    if (!res.ok) throw await parseError(res);
    const data = await readResponseJson<{ addresses: CfVerifiedDestinationAddress[] }>(res);
    return data.addresses ?? [];
  },

  async create(
    email: string,
    accountId?: string,
  ): Promise<CfVerifiedDestinationAddress> {
    const res = await desktopAwareFetch(
      `/api/email/email-routing/addresses${qs(accountId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      },
    );
    if (!res.ok) throw await parseError(res);
    const data = await readResponseJson<{ address: CfVerifiedDestinationAddress }>(res);
    return data.address;
  },

  async remove(id: string, accountId?: string): Promise<void> {
    const res = await desktopAwareFetch(
      `/api/email/email-routing/addresses/${encodeURIComponent(id)}${qs(accountId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw await parseError(res);
  },
};
