/**
 * Read Wrangler bindings on Cloudflare (OpenNext). Secrets are on `env`, not always on
 * `process.env` for the lifetime of a warm isolate.
 */
type CloudflareContextStore = {
  env?: Record<string, unknown>;
};

function cloudflareEnv(): Record<string, unknown> | undefined {
  const store = (
    globalThis as unknown as Record<symbol, CloudflareContextStore | undefined>
  )[Symbol.for("__cloudflare-context__")];
  return store?.env;
}

export function workerEnvString(name: string): string | undefined {
  const fromBinding = cloudflareEnv()?.[name];
  if (typeof fromBinding === "string" && fromBinding.trim()) {
    return fromBinding.trim();
  }
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }
  return undefined;
}
