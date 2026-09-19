// Calls the deployed Worker's schema + owner-setup endpoints — ported from
// desktop/src-tauri/src/auto_install/{schema,errors}.rs and
// desktop/src-tauri/src/auth/owner_session.rs (owner_setup_admin).

export type InitDbResult = {
  ok: boolean;
  alreadyInitialized: boolean;
  applied: string[];
  skipped: string[];
  cleared: boolean;
};

function isTransientSchemaError(err: string): boolean {
  const lower = err.toLowerCase();
  return (
    lower.includes("1042") ||
    lower.includes("404") ||
    lower.includes("1101") ||
    lower.includes("1104") ||
    lower.includes("not found") ||
    lower.includes("401") ||
    lower.includes("unauthorized")
  );
}

async function postSchemaEndpoint(
  workerUrl: string,
  pepper: string | undefined,
  path: string,
  step: string,
  cfAccessToken?: string,
): Promise<InitDbResult> {
  const base = workerUrl.trim().replace(/\/$/, "");
  if (!base) throw new Error("Worker URL is empty");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pepper?.trim()) headers["X-Auth-Pepper"] = pepper.trim();
  else if (cfAccessToken?.trim()) headers["X-Cf-Access-Token"] = cfAccessToken.trim();
  else throw new Error(`${step} requires AUTH_PEPPER or Cloudflare OAuth`);
  const res = await fetch(`${base}${path}`, { method: "POST", headers, body: "{}" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${step} returned ${res.status}: ${text.slice(0, 280)}`);
  }
  const value = await res.json();
  return {
    ok: Boolean(value.ok),
    alreadyInitialized: Boolean(value.alreadyInitialized ?? value.already_initialized),
    applied: value.applied ?? [],
    skipped: value.skipped ?? [],
    cleared: Boolean(value.cleared),
  };
}

async function withRetry(
  fn: () => Promise<InitDbResult>,
  step: string,
  onLog?: (line: string) => void,
): Promise<InitDbResult> {
  const attempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isTransientSchemaError(String(err))) break;
      onLog?.(`${step} not ready yet (attempt ${attempt}/${attempts}) — retrying…`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastErr;
}

/** Empty D1 only. Fails with 409 if product tables already exist. */
export async function initWorkerDb(
  workerUrl: string,
  pepper: string | undefined,
  onLog?: (line: string) => void,
): Promise<InitDbResult> {
  return withRetry(
    () => postSchemaEndpoint(workerUrl, pepper, "/console/init-db", "init-db"),
    "init-db",
    onLog,
  );
}

/** Pending migrations only. Never drops tables. */
export async function migrateWorkerDb(
  workerUrl: string,
  pepper: string | undefined,
  onLog?: (line: string) => void,
  cfAccessToken?: string,
): Promise<InitDbResult> {
  return withRetry(
    () =>
      postSchemaEndpoint(
        workerUrl,
        pepper,
        "/console/migrate-db",
        "migrate-db",
        cfAccessToken,
      ),
    "migrate-db",
    onLog,
  );
}

export type OwnerSetupResult = { passtoken: string };

/** POST /console/setup-admin with X-Auth-Pepper — issues the one-time owner passtoken. */
export async function ownerSetupAdmin(
  workerUrl: string,
  pepper: string,
): Promise<OwnerSetupResult> {
  const base = workerUrl.trim().replace(/\/$/, "");
  if (!base) throw new Error("Worker URL is required");
  if (!pepper.trim()) throw new Error("Install pepper is missing. Re-run install.");
  const res = await fetch(`${base}/console/setup-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Pepper": pepper.trim() },
    body: "{}",
  });
  const value = await res.json().catch(() => ({}));
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(value?.error ?? "Could not set up owner");
  }
  const passtoken = value?.passtoken;
  if (!passtoken) throw new Error("Worker did not return a passtoken");
  return { passtoken };
}

/** POST /console/reset-admin — re-issue passtoken when setup-admin cannot run. */
export async function resetOwnerAdmin(
  workerUrl: string,
  cfAccessToken: string,
  cfAccountId?: string,
): Promise<OwnerSetupResult> {
  const base = workerUrl.trim().replace(/\/$/, "");
  if (!base) throw new Error("Worker URL is required");
  const token = cfAccessToken.trim();
  if (!token) throw new Error("Cloudflare access token is required");
  const res = await fetch(`${base}/console/reset-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cfAccessToken: token,
      ...(cfAccountId?.trim() ? { cfAccountId: cfAccountId.trim() } : {}),
    }),
  });
  const value = (await res.json().catch(() => ({}))) as {
    passtoken?: string;
    error?: string;
  };
  if (!res.ok || !value.passtoken) {
    throw new Error(value.error ?? "Could not re-issue owner passtoken");
  }
  return { passtoken: value.passtoken };
}

export async function waitForWorkerReady(
  workerUrl: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const backoffs = [2, 4, 8, 16];
  onLog?.(`Waiting for ${workerUrl} to become reachable…`);
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    if (attempt > 0) {
      const delay = backoffs[attempt - 1];
      onLog?.(`Worker not ready yet — retrying in ${delay}s (attempt ${attempt + 1}/${backoffs.length + 1})…`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    }
    try {
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/health`);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json?.ok === true) {
          onLog?.(`Worker is reachable (attempt ${attempt + 1})`);
          return;
        }
      }
    } catch {
      /* retry */
    }
  }
  onLog?.("Worker did not respond to /health within ~30s — continuing anyway.");
}

/** Public probe: is an owner passtoken already configured on this Worker? */
export async function fetchOwnerConfigured(workerUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/console/auth-status`);
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.ownerConfigured);
  } catch {
    return false;
  }
}

export async function fetchWorkerVersion(workerUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/health`);
    if (!res.ok) return null;
    const json = await res.json();
    const version = String(json?.version ?? "").trim();
    return version && version !== "unknown" ? version : null;
  } catch {
    return null;
  }
}
