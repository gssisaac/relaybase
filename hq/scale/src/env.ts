/**
 * Node process env, not a Cloudflare Workers `Bindings` object — hq/scale runs
 * as a plain Node server (unlike worker/, which runs on the Workers runtime).
 * See docs/features/crm-mode-v0.2.md §1.3.
 */
export type Env = {
  PORT: string | undefined;
};

export function readEnv(): Env {
  return {
    PORT: process.env.PORT,
  };
}
