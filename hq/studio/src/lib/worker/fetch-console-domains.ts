import { studioService } from "@services/studio-service";

type DomainRow = { domain?: string };

async function consoleAccessToken(
  workerUrl: string,
  passtoken: string,
): Promise<string | null> {
  const loginRes = await fetch(`${workerUrl}/console/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passtoken, label: "relaybase-studio-catalog" }),
  });
  const login = (await loginRes.json().catch(() => ({}))) as {
    consoleRefreshToken?: string;
    error?: string;
  };
  if (!loginRes.ok || !login.consoleRefreshToken) return null;

  const refreshRes = await fetch(`${workerUrl}/console/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: login.consoleRefreshToken,
      scope: "console",
    }),
  });
  const refreshed = (await refreshRes.json().catch(() => ({}))) as {
    accessToken?: string;
  };
  return refreshed.accessToken?.trim() || null;
}

/** Server-side Worker catalog (optional STUDIO_WORKER_CONSOLE_PASSTOKEN). */
export async function fetchWorkerCatalogDomainNames(): Promise<string[]> {
  const account = studioService.read().account;
  const workerUrl = account.workerUrl?.trim().replace(/\/$/, "") ?? "";
  const passtoken = process.env.STUDIO_WORKER_CONSOLE_PASSTOKEN?.trim() ?? "";
  if (!workerUrl || !passtoken) return [];

  const accessToken = await consoleAccessToken(workerUrl, passtoken);
  if (!accessToken) return [];

  const res = await fetch(`${workerUrl}/console/domains`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as { domains?: DomainRow[] };
  if (!res.ok) return [];

  const names = new Set<string>();
  for (const row of data.domains ?? []) {
    const d = row.domain?.trim().toLowerCase();
    if (d) names.add(d);
  }
  return [...names];
}
