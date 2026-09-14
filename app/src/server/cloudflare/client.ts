// Server-only Cloudflare REST API v4 client — ported from
// desktop/src-tauri/src/cloudflare/client.ts (Rust) so the web app can drive
// the same install pipeline from Next.js Route Handlers. Import only from
// Route Handlers / server modules — never from client components.

const CF_API = "https://api.cloudflare.com/client/v4";

// Cloudflare API responses are loosely-typed JSON; a minimal alias keeps
// call sites terse without `any` triggering lint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type CfClient = {
  accountId: string;
  apiToken: string;
};

async function cfRequest(
  client: CfClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<Json> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${client.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const value = await res.json().catch(() => ({}));
  if (!res.ok || value?.success === false) {
    const errors = value?.errors ?? [];
    throw new Error(
      `Cloudflare API error (${res.status}) ${method} ${path}: ${JSON.stringify(errors)}`,
    );
  }
  return value;
}

async function cfGetStatus(client: CfClient, path: string): Promise<number> {
  const res = await fetch(`${CF_API}${path}`, {
    headers: { Authorization: `Bearer ${client.apiToken}` },
  });
  return res.status;
}

function isForbidden(err: unknown): boolean {
  const lower = String(err).toLowerCase();
  return lower.includes("403") || lower.includes("forbidden");
}

function isNotFound(err: unknown): boolean {
  const lower = String(err).toLowerCase();
  return lower.includes("404") || lower.includes("not found") || lower.includes("does not exist");
}

function isAlreadyExists(err: unknown): boolean {
  const lower = String(err).toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("already exist") ||
    lower.includes("duplicate") ||
    lower.includes("409") ||
    lower.includes("code: 10004")
  );
}

export function r2DashboardUrl(accountId: string): string {
  return `https://dash.cloudflare.com/${accountId}/r2`;
}

function r2SubscriptionRequiredError(accountId: string): Error {
  return new Error(
    `R2_SUBSCRIPTION_REQUIRED: Cloudflare R2 is not active on this account ` +
      `(never enabled, or the $0 subscription was removed after a few days). ` +
      `Open ${r2DashboardUrl(accountId)} and add R2 back, then try again.`,
  );
}

function isR2SubscriptionRequired(err: unknown): boolean {
  const lower = String(err).toLowerCase();
  return (
    lower.includes("r2_subscription_required") ||
    lower.includes("10042") ||
    lower.includes("enable r2") ||
    lower.includes("r2 through the cloudflare dashboard") ||
    (lower.includes("r2") && lower.includes("subscription") && lower.includes("removed"))
  );
}

/** Resolve the Cloudflare account id for an OAuth token via GET /accounts. */
export async function resolveAccountId(apiToken: string): Promise<string> {
  const client: CfClient = { accountId: "", apiToken };
  const value = await cfRequest(client, "GET", "/accounts?per_page=50");
  const id = value?.result?.[0]?.id;
  if (!id) throw new Error("No Cloudflare accounts accessible with this token.");
  return id as string;
}

/** Fail before create/delete when this account has no R2 product. */
export async function assertR2Subscription(client: CfClient): Promise<void> {
  try {
    await cfRequest(client, "GET", `/accounts/${client.accountId}/r2/buckets`);
  } catch (err) {
    if (isR2SubscriptionRequired(err)) throw r2SubscriptionRequiredError(client.accountId);
    // Other errors (generic 403 on OAuth install tokens) are tolerated —
    // buckets can still be created/reused by name.
  }
}

async function namedResourceStatus(client: CfClient, path: string): Promise<boolean | null> {
  const status = await cfGetStatus(client, path);
  if (status === 404) return false;
  if (status >= 200 && status < 300) return true;
  return null;
}

export async function findR2Bucket(client: CfClient, name: string): Promise<boolean> {
  const present = await namedResourceStatus(
    client,
    `/accounts/${client.accountId}/r2/buckets/${name}`,
  );
  if (present !== null) return present;
  try {
    const list = await cfRequest(client, "GET", `/accounts/${client.accountId}/r2/buckets`);
    const buckets = list?.result?.buckets ?? [];
    return buckets.some((b: Json) => b?.name === name);
  } catch (err) {
    if (isR2SubscriptionRequired(err)) throw r2SubscriptionRequiredError(client.accountId);
    if (isForbidden(err)) return false;
    throw err;
  }
}

export async function ensureR2Bucket(client: CfClient, name: string): Promise<void> {
  if (await findR2Bucket(client, name)) return;
  try {
    await cfRequest(client, "POST", `/accounts/${client.accountId}/r2/buckets`, { name });
  } catch (err) {
    if (isAlreadyExists(err)) return;
    if (isR2SubscriptionRequired(err)) throw r2SubscriptionRequiredError(client.accountId);
    throw err;
  }
}

/** Returns true when a Worker script with this exact name already exists. */
export async function workerScriptExists(client: CfClient, scriptName: string): Promise<boolean> {
  for (const suffix of ["settings", "deployments"]) {
    const present = await namedResourceStatus(
      client,
      `/accounts/${client.accountId}/workers/scripts/${scriptName}/${suffix}`,
    );
    if (present !== null) return present;
  }
  return false;
}

export async function workerHealthOk(workerUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export const DEFAULT_WORKER_CRON = "*/15 * * * *";

/**
 * Upload a Worker module with R2, D1, send_email, and plain-text vars.
 *
 * Existing Worker secrets are preserved across the upload by emitting an
 * `inherit` binding for every currently-set secret name (e.g. `CF_API_TOKEN`,
 * which the app never stores) and by listing `secret_text` / `secret_key` in
 * `keep_bindings` as a type-level fallback. Secrets the caller intends to
 * rotate are re-PUT after this returns; inherit simply keeps the previous
 * value until then. The script is never DELETEd — a PUT overwrite replaces
 * code and non-secret bindings while carrying secrets forward.
 */
export async function uploadWorkerScript(
  client: CfClient,
  scriptName: string,
  jsSource: string,
  r2Bucket: string,
  d1Bindings: Array<{ binding: string; id: string }>,
  workerVersion: string,
  desktopVersion: string,
): Promise<void> {
  // Snapshot existing secret names before upload so we can inherit them and
  // verify none were dropped. 404 (first install) → empty list.
  const existingSecrets = await listWorkerSecrets(client, scriptName).catch(
    (): string[] => [],
  );

  const bindings: Json[] = [
    { type: "r2_bucket", name: "INBOUND", bucket_name: r2Bucket },
    { type: "plain_text", name: "WORKER_SCRIPT_NAME", text: scriptName },
    { type: "plain_text", name: "INBOUND_BUCKET_NAME", text: r2Bucket },
    { type: "plain_text", name: "WORKER_VERSION", text: workerVersion.trim() || "unknown" },
    { type: "plain_text", name: "DESKTOP_VERSION", text: desktopVersion.trim() || "unknown" },
    { type: "send_email", name: "EMAIL" },
  ];
  for (const { binding, id } of d1Bindings) {
    if (!binding || !id) continue;
    bindings.push({ type: "d1", name: binding, id, database_id: id });
  }
  // Inherit every existing secret by name so the new version keeps it
  // (e.g. CF_API_TOKEN). Secrets we rotate are re-PUT after upload.
  for (const name of existingSecrets) {
    bindings.push({ type: "inherit", name });
  }
  const metadata = {
    main_module: "worker.js",
    bindings,
    // secret_text + secret_key mirrors wrangler; plain_text/json omitted on
    // purpose so stale system vars (WORKER_VERSION, …) are replaced.
    keep_bindings: ["secret_text", "secret_key"],
    compatibility_date: "2025-06-01",
    triggers: { crons: [DEFAULT_WORKER_CRON] },
  };

  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  form.set(
    "worker.js",
    new Blob([jsSource], { type: "application/javascript+module" }),
    "worker.js",
  );

  const res = await fetch(
    `${CF_API}/accounts/${client.accountId}/workers/scripts/${scriptName}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${client.apiToken}` },
      body: form,
    },
  );
  const value = await res.json().catch(() => ({}));
  if (!res.ok || value?.success === false) {
    throw new Error(`Worker upload failed (${res.status}): ${JSON.stringify(value)}`);
  }

  // Verify no previously-set secret was silently dropped by the upload.
  if (existingSecrets.length > 0) {
    const afterSecrets = await listWorkerSecrets(client, scriptName).catch(
      (): string[] => [],
    );
    const lost = existingSecrets.filter((n) => !afterSecrets.includes(n));
    if (lost.length > 0) {
      throw new Error(
        `Worker upload dropped existing secrets: ${lost.join(", ")}. ` +
          "Reinstall the Worker and re-add the missing secret, or contact support.",
      );
    }
  }
}

export async function listWorkerBindings(
  client: CfClient,
  scriptName: string,
): Promise<Array<{ kind: string; name: string }>> {
  const value = await cfRequest(
    client,
    "GET",
    `/accounts/${client.accountId}/workers/scripts/${scriptName}/settings`,
  );
  const arr = value?.result?.bindings ?? [];
  return arr.map((b: Json) => ({ kind: b?.type ?? "?", name: b?.name ?? "?" }));
}

export async function listWorkerSecrets(client: CfClient, scriptName: string): Promise<string[]> {
  const value = await cfRequest(
    client,
    "GET",
    `/accounts/${client.accountId}/workers/scripts/${scriptName}/secrets`,
  );
  const arr = value?.result ?? [];
  return arr.map((b: Json) => b?.name).filter((n: unknown): n is string => Boolean(n));
}

export async function putWorkerSchedules(
  client: CfClient,
  scriptName: string,
  cron: string,
): Promise<void> {
  await cfRequest(
    client,
    "PUT",
    `/accounts/${client.accountId}/workers/scripts/${scriptName}/schedules`,
    [{ cron }],
  );
}

/** Create a D1 database. If the name already exists, return its uuid. */
export async function createD1Database(client: CfClient, name: string): Promise<string> {
  const existing = await findD1Id(client, name);
  if (existing) return existing;
  try {
    const value = await cfRequest(client, "POST", `/accounts/${client.accountId}/d1/database`, {
      name,
    });
    const id = value?.result?.uuid ?? value?.result?.id;
    if (!id) throw new Error(`Cloudflare created D1 ${name} but the response had no uuid`);
    return id as string;
  } catch (err) {
    if (isAlreadyExists(err)) {
      const id = await findD1Id(client, name);
      if (id) return id;
      throw new Error(`D1 ${name} already exists but could not be listed`);
    }
    throw err;
  }
}

function d1IdFromRow(row: Json): string | null {
  const id = row?.uuid ?? row?.id;
  return typeof id === "string" && id.length >= 16 ? id : null;
}

export async function findD1Id(client: CfClient, name: string): Promise<string | null> {
  try {
    const value = await cfRequest(
      client,
      "GET",
      `/accounts/${client.accountId}/d1/database?name=${encodeURIComponent(name)}&per_page=10`,
    );
    const row = (value?.result ?? []).find((r: Json) => r?.name === name);
    if (row) {
      const id = d1IdFromRow(row);
      if (id) return id;
    }
  } catch (err) {
    if (!isForbidden(err)) throw err;
  }
  const list = await listD1Databases(client);
  return list.find(([n]) => n === name)?.[1] ?? null;
}

/** Returns `[name, uuid]` pairs for every D1 database in the account. */
export async function listD1Databases(client: CfClient): Promise<Array<[string, string]>> {
  const out: Array<[string, string]> = [];
  let page = 1;
  for (;;) {
    const value = await cfRequest(
      client,
      "GET",
      `/accounts/${client.accountId}/d1/database?per_page=100&page=${page}`,
    );
    const rows = value?.result ?? [];
    for (const row of rows) {
      const id = d1IdFromRow(row);
      if (id && row?.name) out.push([row.name, id]);
    }
    const total = value?.result_info?.total_count ?? out.length;
    if (rows.length === 0 || out.length >= total) break;
    page += 1;
  }
  return out;
}

/** D1 binding name → database uuid from the live Worker script settings. */
export async function listWorkerD1Bindings(
  client: CfClient,
  scriptName: string,
): Promise<Array<[string, string]>> {
  const value = await cfRequest(
    client,
    "GET",
    `/accounts/${client.accountId}/workers/scripts/${scriptName}/settings`,
  );
  const arr = value?.result?.bindings ?? [];
  const out: Array<[string, string]> = [];
  for (const b of arr) {
    if (b?.type !== "d1") continue;
    const binding = b?.name;
    const id = b?.database_id ?? b?.id;
    if (binding && id) out.push([binding, id]);
  }
  return out;
}

/** Resolve `https://{script}.{subdomain}.workers.dev` for this account. */
export async function accountWorkersDevUrl(client: CfClient, scriptName: string): Promise<string> {
  const sub = await cfRequest(client, "GET", `/accounts/${client.accountId}/workers/subdomain`);
  const subdomain = String(sub?.result?.subdomain ?? "").trim();
  if (!subdomain) {
    throw new Error(
      "This Cloudflare account has no workers.dev subdomain. Authorize the account that already owns your Relaybase Worker.",
    );
  }
  return `https://${scriptName}.${subdomain}.workers.dev`;
}

export async function enableWorkersDev(client: CfClient, scriptName: string): Promise<string> {
  try {
    await cfRequest(
      client,
      "POST",
      `/accounts/${client.accountId}/workers/scripts/${scriptName}/subdomain`,
      { enabled: true },
    );
  } catch {
    // best-effort, mirrors desktop
  }
  return accountWorkersDevUrl(client, scriptName);
}

export async function putWorkerSecret(
  client: CfClient,
  scriptName: string,
  name: string,
  text: string,
): Promise<void> {
  await cfRequest(
    client,
    "PUT",
    `/accounts/${client.accountId}/workers/scripts/${scriptName}/secrets`,
    { name, text, type: "secret_text" },
  );
}

export async function deleteWorkerScript(client: CfClient, scriptName: string): Promise<void> {
  try {
    await cfRequest(client, "DELETE", `/accounts/${client.accountId}/workers/scripts/${scriptName}`);
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

export async function deleteR2Bucket(client: CfClient, name: string): Promise<void> {
  try {
    await cfRequest(client, "DELETE", `/accounts/${client.accountId}/r2/buckets/${name}`);
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

export async function deleteD1Database(client: CfClient, databaseId: string): Promise<void> {
  try {
    await cfRequest(client, "DELETE", `/accounts/${client.accountId}/d1/database/${databaseId}`);
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

export type ResourceOccupancy = {
  count: number;
  truncated: boolean;
  occupied: boolean;
  unknown: boolean;
};

const R2_COUNT_CAP = 5000;

function r2ListObjects(value: Json): Json[] {
  return value?.result?.objects ?? value?.result ?? [];
}
function r2ListCursor(value: Json): string | null {
  return value?.result?.cursor ?? value?.result_info?.cursor ?? null;
}
function r2ListTruncated(value: Json): boolean {
  return Boolean(value?.result?.truncated);
}

export async function countR2Objects(client: CfClient, name: string): Promise<ResourceOccupancy> {
  let count = 0;
  let cursor: string | null = null;
  for (;;) {
    let path = `/accounts/${client.accountId}/r2/buckets/${name}/objects?per_page=1000`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    let value: Json;
    try {
      value = await cfRequest(client, "GET", path);
    } catch (err) {
      if (isNotFound(err)) return { count: 0, truncated: false, occupied: false, unknown: false };
      return { count: 0, truncated: false, occupied: true, unknown: true };
    }
    const objects = r2ListObjects(value);
    count += objects.length;
    if (count >= R2_COUNT_CAP) {
      return { count: R2_COUNT_CAP, truncated: true, occupied: true, unknown: false };
    }
    const next = r2ListCursor(value);
    const truncated = r2ListTruncated(value);
    if (objects.length === 0 || !truncated || !next || next === cursor) break;
    cursor = next;
  }
  return { count, truncated: false, occupied: count > 0, unknown: false };
}

export async function queryD1(client: CfClient, databaseId: string, sql: string): Promise<Json[]> {
  const value = await cfRequest(
    client,
    "POST",
    `/accounts/${client.accountId}/d1/database/${databaseId}/query`,
    { sql },
  );
  return value?.result?.[0]?.results ?? [];
}

function jsonCount(row: Json): number {
  const v = row?.n ?? row?.["COUNT(*)"] ?? row?.["count(*)"];
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function d1TableIdentOk(name: string): boolean {
  return name.length > 0 && /^[A-Za-z0-9_]+$/.test(name);
}

export async function countD1UserRows(client: CfClient, databaseId: string): Promise<ResourceOccupancy> {
  let tables: Json[];
  try {
    tables = await queryD1(
      client,
      databaseId,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    );
  } catch {
    return { count: 0, truncated: false, occupied: true, unknown: true };
  }
  let total = 0;
  for (const row of tables) {
    const name = row?.name;
    if (!name || name === "d1_migrations" || !d1TableIdentOk(name)) continue;
    try {
      const rows = await queryD1(client, databaseId, `SELECT COUNT(*) AS n FROM "${name}"`);
      total += jsonCount(rows[0]);
    } catch {
      return { count: 0, truncated: false, occupied: true, unknown: true };
    }
  }
  return { count: total, truncated: false, occupied: total > 0, unknown: false };
}

/** Delete every object in an R2 bucket so the bucket itself can be removed. */
export async function emptyR2Bucket(client: CfClient, name: string): Promise<number> {
  let deleted = 0;
  let cursor: string | null = null;
  for (;;) {
    let path = `/accounts/${client.accountId}/r2/buckets/${name}/objects?per_page=1000`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    let value: Json;
    try {
      value = await cfRequest(client, "GET", path);
    } catch (err) {
      if (isNotFound(err)) return deleted;
      throw err;
    }
    const objects = r2ListObjects(value);
    if (objects.length === 0) break;
    for (const obj of objects) {
      const key = obj?.key ?? obj?.name;
      if (!key) continue;
      const encoded = encodeURIComponent(key).replace(/%2F/g, "/");
      try {
        await cfRequest(
          client,
          "DELETE",
          `/accounts/${client.accountId}/r2/buckets/${name}/objects/${encoded}`,
        );
        deleted += 1;
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }
    const next = r2ListCursor(value);
    const truncated = r2ListTruncated(value);
    if (!truncated || !next || next === cursor) break;
    cursor = next;
  }
  return deleted;
}
