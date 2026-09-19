/**
 * Node process env, not a Cloudflare Workers `Bindings` object — hq/studio runs
 * as a plain Node server (unlike worker/, which runs on the Workers runtime).
 * See docs/features/studio-mode-v0.2.md §1.3.
 */
export type Env = {
  PORT: string | undefined;
  DATABASE_URL: string | undefined;
};

export function readEnv(): Env {
  return {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}
