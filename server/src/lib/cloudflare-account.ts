import { normalizeCfAccountId } from "./cf-account-id.ts";

const CF_API = "https://api.cloudflare.com/client/v4";

type ZoneAccountRow = {
  id?: string;
  account?: { id?: string };
};

/**
 * Discover the Cloudflare account this token can see.
 *
 * Prefer `GET /zones` — the server token already has Zone Read, and each
 * zone includes `account.id`. `GET /accounts` is a fallback (needs Account
 * Read, which Email Sending tokens often lack).
 */
export async function resolveCfAccountIdFromToken(
  token: string,
): Promise<string | null> {
  const bearer = token.trim();
  if (!bearer) return null;
  const fromZone = await accountIdFromZones(bearer);
  if (fromZone) return fromZone;
  return accountIdFromAccounts(bearer);
}

async function accountIdFromZones(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${CF_API}/zones?per_page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      success?: boolean;
      result?: ZoneAccountRow[];
    };
    if (!data.success || !Array.isArray(data.result)) return null;
    for (const row of data.result) {
      const id = normalizeCfAccountId(row.account?.id);
      if (id) return id;
    }
  } catch {
    return null;
  }
  return null;
}

async function accountIdFromAccounts(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${CF_API}/accounts?per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
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
