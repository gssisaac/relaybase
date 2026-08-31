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
  meta?: { changes?: number; [k: string]: unknown };
};

interface CloudflareEnv {
  ASSETS?: { fetch: (req: Request | string) => Promise<Response> };
  DB?: D1Database;
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
  // CF OAuth clients (public PKCE — Token Authentication Method is
  // "None (PKCE)", so there is NO client secret). The desktop generates
  // the PKCE verifier/challenge, opens the authorize URL, and exchanges
  // the code itself; /oauth/callback just relays the code via a
  // `relaybase://` deep link. No CF user credentials are stored here.
  // CF_OAUTH_CLIENT_ID = install / Worker update (Workers + R2 + D1).
  // CF_OAUTH_PASSTOKEN_CLIENT_ID = forgot-passtoken (Secrets Store Write).
  CF_OAUTH_CLIENT_ID?: string;
  CF_OAUTH_PASSTOKEN_CLIENT_ID?: string;
  CF_OAUTH_REDIRECT_URI?: string;
}
