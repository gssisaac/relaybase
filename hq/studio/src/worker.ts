import app from "./app";
import { flushR2Storage, initR2Storage } from "./cf/storage-fs";
import { runSchedulerCron } from "./scheduler";

export type StudioWorkerEnv = {
  STUDIO_DATA: {
    list(options?: { prefix?: string; cursor?: string }): Promise<{
      objects: { key: string }[];
      truncated: boolean;
      cursor?: string;
    }>;
    get(key: string): Promise<{ text(): Promise<string> } | null>;
    put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<unknown>;
    delete(key: string): Promise<void>;
  };
  HQ_JWT_SECRET?: string;
  HQ_VAULT_SECRET?: string;
  HQ_INTERNAL_AUTH_SECRET?: string;
  STUDIO_API_SECRET?: string;
  HQ_AUTH_APP_URL?: string;
  NODE_ENV?: string;
};

export type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const DATA_ROOT = "/data";

function applyEnv(env: StudioWorkerEnv): void {
  if (env.HQ_JWT_SECRET) process.env.HQ_JWT_SECRET = env.HQ_JWT_SECRET;
  if (env.HQ_VAULT_SECRET) process.env.HQ_VAULT_SECRET = env.HQ_VAULT_SECRET;
  if (env.HQ_INTERNAL_AUTH_SECRET) process.env.HQ_INTERNAL_AUTH_SECRET = env.HQ_INTERNAL_AUTH_SECRET;
  if (env.STUDIO_API_SECRET) process.env.STUDIO_API_SECRET = env.STUDIO_API_SECRET;
  if (env.HQ_AUTH_APP_URL) process.env.HQ_AUTH_APP_URL = env.HQ_AUTH_APP_URL;
  process.env.NODE_ENV = env.NODE_ENV ?? "production";
  process.env.STUDIO_DATA_DIR = DATA_ROOT;
}

let storageReady: Promise<void> | null = null;

function ensureStorage(env: StudioWorkerEnv): Promise<void> {
  if (!storageReady) {
    storageReady = initR2Storage(env.STUDIO_DATA, DATA_ROOT);
  }
  return storageReady;
}

export default {
  async fetch(request: Request, env: StudioWorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
    applyEnv(env);
    await ensureStorage(env);
    const response = await app.fetch(request, env as unknown as Record<string, unknown>);
    ctx.waitUntil(flushR2Storage());
    return response;
  },

  async scheduled(_event: unknown, env: StudioWorkerEnv, ctx: WorkerExecutionContext): Promise<void> {
    applyEnv(env);
    await ensureStorage(env);
    await runSchedulerCron();
    ctx.waitUntil(flushR2Storage());
  },
};
