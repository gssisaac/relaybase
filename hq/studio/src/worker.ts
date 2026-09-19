/**
 * Edge entry for studio-api.relaybase.email — forwards to the Node + Postgres service on Railway.
 */
export type StudioWorkerEnv = {
  STUDIO_BACKEND_URL?: string;
};

function backendOrigin(env: StudioWorkerEnv): string {
  const raw =
    env.STUDIO_BACKEND_URL?.trim() ||
    "https://hq-relaybase-studio-dbver-production.up.railway.app";
  return raw.replace(/\/$/, "");
}

export default {
  async fetch(request: Request, env: StudioWorkerEnv): Promise<Response> {
    const incoming = new URL(request.url);
    const target = `${backendOrigin(env)}${incoming.pathname}${incoming.search}`;

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

    return fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }),
    );
  },
};
