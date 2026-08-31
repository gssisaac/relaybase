/** Shared R2 mailbox bucket — inbound and sent are separated by object key prefix. */
export const MAILBOX_R2_BUCKET_NAME = "relaybase-mailbox";
/** @deprecated Use MAILBOX_R2_BUCKET_NAME */
export const INBOUND_R2_BUCKET_NAME = MAILBOX_R2_BUCKET_NAME;

export function defaultInboundR2BucketName(_serviceId?: string): string {
  return MAILBOX_R2_BUCKET_NAME;
}

const LEGACY_INBOUND_R2_BUCKET_PREFIX = "flare-email-inbound";
const LEGACY_INBOUND_R2_BUCKET_NAMES = new Set([
  LEGACY_INBOUND_R2_BUCKET_PREFIX,
  "relaybase-inbound",
]);

export function isLegacyInboundR2BucketName(name?: string | null): boolean {
  const trimmed = name?.trim().toLowerCase() ?? "";
  return (
    !trimmed ||
    LEGACY_INBOUND_R2_BUCKET_NAMES.has(trimmed) ||
    trimmed.startsWith(`${LEGACY_INBOUND_R2_BUCKET_PREFIX}-`)
  );
}

export function resolveInboundR2BucketName(
  _serviceId: string,
  stored?: string | null,
): string {
  if (isLegacyInboundR2BucketName(stored)) {
    return INBOUND_R2_BUCKET_NAME;
  }
  return stored!.trim();
}

export function inboundR2BucketsMatch(
  a?: string | null,
  b?: string | null,
): boolean {
  return (
    resolveInboundR2BucketName("", a).toLowerCase() ===
    resolveInboundR2BucketName("", b).toLowerCase()
  );
}

/** True when the worker binding name differs from the expected bucket (including legacy names until redeploy). */
export function workerInboundR2BucketMismatch(
  expected?: string | null,
  workerReported?: string | null,
): boolean {
  const worker = workerReported?.trim();
  if (!worker) return false;
  const resolvedExpected = resolveInboundR2BucketName("", expected);
  if (
    resolvedExpected.toLowerCase() !==
    resolveInboundR2BucketName("", worker).toLowerCase()
  ) {
    return true;
  }
  return worker.toLowerCase() !== resolvedExpected.toLowerCase();
}

/** Object key prefix inside the shared bucket for one receiving domain. */
export function inboundR2ObjectPrefix(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return "inbound/";
  return `inbound/${normalized}/`;
}

export type InboundR2View = {
  inboundR2BucketName: string;
  inboundR2ObjectPrefix: string;
  inboundR2BucketExists: boolean;
  inboundR2WorkerConfigured: boolean;
  inboundR2WorkerReady: boolean;
  inboundR2WorkerBucketName: string | null;
  inboundR2Mismatch: boolean;
  /** Worker can read/write inbound mail in R2 (ready + names match). */
  inboundR2Configured: boolean;
};
