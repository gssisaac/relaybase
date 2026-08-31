export type InviteLocale = {
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
};

export type InviteDownload = {
  at: string;
};

export type InviteData = {
  email: string;
  createdAt: string;
  locale: InviteLocale;
  browser: string;
  os: string;
  userAgent: string;
  downloads: InviteDownload[];
};

export type IncomingCf = {
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
};

type D1Prepared = {
  bind: (...values: unknown[]) => D1Prepared;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (query: string) => D1Prepared;
};

export type WorkerEnv = {
  DB: D1Database;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  RELAYBASE_WORKER_URL?: string;
  RELAYBASE_API_KEY?: string;
};
