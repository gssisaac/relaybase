/** Cloudflare D1 per-database size cap on Workers Paid (display only). */
export const D1_DATABASE_SIZE_LIMIT_BYTES = 10 * 1024 ** 3;

export type D1BindingSnapshot = {
  configured: boolean;
  databaseName: string;
  binding: string;
  sizeBytes: number | null;
};

export const D1_LOGS_DEFAULT: D1BindingSnapshot = {
  configured: false,
  databaseName: "relaybase-logs",
  binding: "RELAYBASE_LOGS",
  sizeBytes: null,
};

export const D1_INBOX_INDEX_DEFAULT: D1BindingSnapshot = {
  configured: false,
  databaseName: "relaybase-inbox-index",
  binding: "RELAYBASE_INBOX_INDEX",
  sizeBytes: null,
};

export const D1_APP_DEFAULT: D1BindingSnapshot = {
  configured: false,
  databaseName: "relaybase-db",
  binding: "RELAYBASE_DB",
  sizeBytes: null,
};

type D1Payload = {
  logs?: {
    configured?: boolean;
    databaseName?: string;
    binding?: string;
    sizeBytes?: number | null;
  };
  inboxIndex?: {
    configured?: boolean;
    databaseName?: string;
    binding?: string;
    sizeBytes?: number | null;
  };
  app?: {
    configured?: boolean;
    databaseName?: string;
    binding?: string;
    sizeBytes?: number | null;
  };
  logsConfigured?: boolean;
  logsDatabaseName?: string;
  inboxIndexConfigured?: boolean;
  inboxIndexDatabaseName?: string;
};

function parseSize(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function d1BindingFromPayload(
  d1: D1Payload | undefined,
  kind: "logs" | "inboxIndex" | "app",
): D1BindingSnapshot {
  const defaults =
    kind === "logs"
      ? D1_LOGS_DEFAULT
      : kind === "inboxIndex"
        ? D1_INBOX_INDEX_DEFAULT
        : D1_APP_DEFAULT;
  if (!d1) return defaults;

  const nested = kind === "logs" ? d1.logs : kind === "inboxIndex" ? d1.inboxIndex : d1.app;
  if (nested) {
    return {
      configured: Boolean(nested.configured),
      databaseName: nested.databaseName ?? defaults.databaseName,
      binding: nested.binding ?? defaults.binding,
      sizeBytes: parseSize(nested.sizeBytes),
    };
  }

  if (kind === "logs") {
    return {
      configured: Boolean(d1.logsConfigured),
      databaseName: d1.logsDatabaseName ?? defaults.databaseName,
      binding: defaults.binding,
      sizeBytes: null,
    };
  }

  if (kind === "inboxIndex") {
    return {
      configured: Boolean(d1.inboxIndexConfigured),
      databaseName: d1.inboxIndexDatabaseName ?? defaults.databaseName,
      binding: defaults.binding,
      sizeBytes: null,
    };
  }

  return defaults;
}
