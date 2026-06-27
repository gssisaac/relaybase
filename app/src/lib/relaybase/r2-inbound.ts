const API_BASE = "https://api.cloudflare.com/client/v4";

/** Shared R2 bucket — domains are separated by object key prefix, not bucket name. */
export const INBOUND_R2_BUCKET_NAME = "flare-email-inbound";

export function defaultInboundR2BucketName(_serviceId?: string): string {
  return INBOUND_R2_BUCKET_NAME;
}

export function resolveInboundR2BucketName(
  _serviceId: string,
  stored?: string | null,
): string {
  const trimmed = stored?.trim();
  if (!trimmed || trimmed.startsWith("flare-email-inbound-")) {
    return INBOUND_R2_BUCKET_NAME;
  }
  return trimmed;
}

/** Object key prefix inside the shared bucket for one receiving domain. */
export function inboundR2ObjectPrefix(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return "inbound/";
  return `inbound/${normalized}/`;
}

type CfR2Bucket = { name: string };

async function listR2Buckets(
  accountId: string,
  apiToken: string,
): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;

  do {
    const search = new URLSearchParams({ per_page: "1000" });
    if (cursor) search.set("cursor", cursor);
    const res = await fetch(
      `${API_BASE}/accounts/${accountId}/r2/buckets?${search.toString()}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        cache: "no-store",
      },
    );
    const data = (await res.json()) as {
      success?: boolean;
      result?: { buckets?: CfR2Bucket[]; cursor?: string };
      errors?: Array<{ message?: string; code?: number }>;
    };
    if (!res.ok || !data.success) {
      const message =
        data.errors?.[0]?.message ?? `R2 bucket list failed (${res.status})`;
      throw new Error(message);
    }
    for (const bucket of data.result?.buckets ?? []) {
      names.push(bucket.name);
    }
    cursor = data.result?.cursor;
  } while (cursor);

  return names;
}

export async function ensureInboundR2Bucket(params: {
  accountId: string;
  apiToken: string;
  bucketName?: string;
}): Promise<{ created: boolean; bucketName: string }> {
  const bucketName = resolveInboundR2BucketName("", params.bucketName);
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) {
    throw new Error(
      "R2 bucket name must be 3–63 lowercase letters, numbers, or hyphens",
    );
  }

  const existing = await listR2Buckets(params.accountId, params.apiToken);
  if (existing.includes(bucketName)) {
    return { created: false, bucketName };
  }

  const res = await fetch(
    `${API_BASE}/accounts/${params.accountId}/r2/buckets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: bucketName }),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string; code?: number }>;
  };
  if (!res.ok || !data.success) {
    const code = data.errors?.[0]?.code;
    if (code === 10004) {
      return { created: false, bucketName };
    }
    const message =
      data.errors?.[0]?.message ?? `R2 bucket create failed (${res.status})`;
    throw new Error(message);
  }

  return { created: true, bucketName };
}

export async function inboundR2BucketExists(params: {
  accountId: string;
  apiToken: string;
  bucketName?: string;
}): Promise<boolean> {
  const bucketName = resolveInboundR2BucketName("", params.bucketName);
  const buckets = await listR2Buckets(params.accountId, params.apiToken);
  return buckets.includes(bucketName);
}
