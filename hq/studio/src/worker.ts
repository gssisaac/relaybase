/**
 * Edge entry for studio-api.relaybase.email — forwards to the Node + Postgres service on Railway.
 */
export type StudioWorkerEnv = {
  STUDIO_BACKEND_URL?: string;
};

function backendOrigin(env: StudioWorkerEnv): string | null {
  const raw = env.STUDIO_BACKEND_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default {
  async fetch(request: Request, env: StudioWorkerEnv): Promise<Response> {
    const origin = backendOrigin(env);
    if (!origin) {
      return Response.json(
        { error: "Studio backend is not configured (STUDIO_BACKEND_URL)." },
        { status: 503 },
      );
    }

    const incoming = new URL(request.url);
    const target = `${origin}${incoming.pathname}${incoming.search}`;

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
