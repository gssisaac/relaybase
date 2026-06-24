import type { InboundEmailEvent } from "./inbound-events";
import { sha256Hex } from "./crypto";

const WEBHOOK_PREFIX = "webhook:";
const MAX_WEBHOOKS_PER_DOMAIN = 3;
const WEBHOOK_SECRET_PREFIX = "whsec_";

export type StoredWebhook = {
  id: string;
  domain: string;
  url: string;
  secretHash: string;
  createdAt: string;
  active: boolean;
};

export type WebhookRecord = Omit<StoredWebhook, "secretHash">;

function webhookKey(domain: string, id: string): string {
  return `${WEBHOOK_PREFIX}${domain.trim().toLowerCase()}:${id}`;
}

function webhookListPrefix(domain: string): string {
  return `${WEBHOOK_PREFIX}${domain.trim().toLowerCase()}:`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const encoded = btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${WEBHOOK_SECRET_PREFIX}${encoded}`;
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToHex(new Uint8Array(signature));
}

function toPublicRecord(stored: StoredWebhook): WebhookRecord {
  const { secretHash: _secretHash, ...record } = stored;
  return record;
}

export async function listWebhooks(
  kv: KVNamespace,
  domain: string,
): Promise<WebhookRecord[]> {
  const listed = await kv.list({ prefix: webhookListPrefix(domain), limit: 20 });
  const records: WebhookRecord[] = [];

  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    const stored = JSON.parse(raw) as StoredWebhook;
    if (!stored.active) continue;
    records.push(toPublicRecord(stored));
  }

  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return records;
}

export async function createWebhook(
  kv: KVNamespace,
  params: { domain: string; url: string; secret?: string | null },
): Promise<{ webhook: WebhookRecord; secret: string }> {
  const domain = params.domain.trim().toLowerCase();
  const url = params.url.trim();
  if (!isValidWebhookUrl(url)) {
    throw new Error("url must be a valid http(s) URL");
  }

  const existing = await listWebhooks(kv, domain);
  if (existing.length >= MAX_WEBHOOKS_PER_DOMAIN) {
    throw new Error(`maximum ${MAX_WEBHOOKS_PER_DOMAIN} webhooks per domain`);
  }

  const secret = params.secret?.trim() || generateWebhookSecret();
  const id = crypto.randomUUID();
  const stored: StoredWebhook = {
    id,
    domain,
    url,
    secretHash: await sha256Hex(secret),
    createdAt: new Date().toISOString(),
    active: true,
  };

  await kv.put(webhookKey(domain, id), JSON.stringify(stored));
  await storeWebhookSecret(kv, domain, id, secret);
  return { webhook: toPublicRecord(stored), secret };
}

export async function deleteWebhook(
  kv: KVNamespace,
  domain: string,
  id: string,
): Promise<boolean> {
  const key = webhookKey(domain, id);
  const raw = await kv.get(key);
  if (!raw) return false;
  await kv.delete(key);
  await removeWebhookSecret(kv, domain, id);
  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWebhook(
  webhook: StoredWebhook,
  secret: string,
  event: InboundEmailEvent,
): Promise<boolean> {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const signature = await hmacSha256Hex(secret, signedPayload);

  const res = await fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Flare-Signature": `t=${timestamp},v1=${signature}`,
      "X-Flare-Event-Id": event.id,
      "X-Flare-Event-Type": event.type,
    },
    body,
  });

  return res.ok;
}

export async function deliverWebhooks(
  kv: KVNamespace,
  domain: string,
  event: InboundEmailEvent,
): Promise<void> {
  const listed = await kv.list({ prefix: webhookListPrefix(domain), limit: 20 });
  const delays = [0, 1_000, 4_000, 16_000];

  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    const webhook = JSON.parse(raw) as StoredWebhook;
    if (!webhook.active) continue;

    // Secret is only known at creation; for delivery we store plaintext secret
    // alongside hash in a separate KV key set at create time.
    const secretRaw = await kv.get(`webhook:secret:${domain}:${webhook.id}`);
    if (!secretRaw) continue;

    let delivered = false;
    for (const delay of delays) {
      if (delay > 0) await sleep(delay);
      try {
        if (await postWebhook(webhook, secretRaw, event)) {
          delivered = true;
          break;
        }
      } catch (error) {
        console.error("Webhook delivery failed", webhook.url, error);
      }
    }

    if (!delivered) {
      await kv.put(
        `webhook:fail:${domain}:${webhook.id}:${event.id}`,
        JSON.stringify({
          webhookId: webhook.id,
          url: webhook.url,
          eventId: event.id,
          failedAt: new Date().toISOString(),
        }),
        { expirationTtl: 7 * 24 * 60 * 60 },
      );
    }
  }
}

export async function storeWebhookSecret(
  kv: KVNamespace,
  domain: string,
  webhookId: string,
  secret: string,
): Promise<void> {
  await kv.put(`webhook:secret:${domain.trim().toLowerCase()}:${webhookId}`, secret);
}

export async function removeWebhookSecret(
  kv: KVNamespace,
  domain: string,
  webhookId: string,
): Promise<void> {
  await kv.delete(`webhook:secret:${domain.trim().toLowerCase()}:${webhookId}`);
}
