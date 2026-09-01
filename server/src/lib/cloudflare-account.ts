import { normalizeCfAccountId } from "./cf-account-id.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

/**
 * Resolve a Cloudflare account id from an API or OAuth token (`GET /accounts`).
 * Used when Worker secret `CF_ACCOUNT_ID` is absent — that secret is optional.
 */
export async function resolveCfAccountIdFromToken(
  token: string,
): Promise<string | null> {
  const bearer = token.trim();
  if (!bearer) return null;
  try {
    const res = await fetch(`${CF_API}/accounts?per_page=50`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    const data = (await res.json()) as {
      success?: boolean;
      result?: Array<{ id?: string }>;
    };
    if (!data.success || !Array.isArray(data.result)) return null;
    for (const row of data.result) {
      const id = normalizeCfAccountId(row.id);
      if (id) return id;
    }
  } catch {
    return null;
  }
  return null;
}
