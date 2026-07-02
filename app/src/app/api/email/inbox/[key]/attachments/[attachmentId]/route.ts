import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  getInboundAttachment,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

type Params = { params: Promise<{ key: string; attachmentId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { key, attachmentId } = await params;
    const data = readUserEmailData(userId);
    const domain = resolveRequestDomain(request, data);
    if (!domain) {
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    const cfg = readRelaybaseWorkerConfig();
    if (!cfg) {
      return Response.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const upstream = await getInboundAttachment(cfg, domain, key, attachmentId);
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "private, max-age=3600");
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("not found")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
