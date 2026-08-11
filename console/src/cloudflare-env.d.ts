interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  get(key: string, type: "json"): Promise<unknown | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string, type: "stream"): Promise<ReadableStream | null>;
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    keys: Array<{ name: string; expiration?: number; metadata?: unknown }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result>;
  exec(query: string): Promise<D1Result>;
};

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
};

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: unknown;
};

interface CloudflareEnv {
  ASSETS?: { fetch: (req: Request | string) => Promise<Response> };
  RELAYBASE_LICENSES?: KVNamespace;
  RELAYBASE_ACCOUNTS?: D1Database;
  // Secrets (wrangler secret put)
  CONSOLE_SESSION_SECRET?: string;
  RELAYBASE_ADMIN_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_PRO_ANNUAL?: string;
  STRIPE_CUSTOMER_PORTAL_CONFIG?: string;
  RECOVERY_SIGNING_SECRET?: string;
  SMTP_FROM?: string;
}
