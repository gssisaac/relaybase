import {
  normalizeDomain,
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
} from "@/lib/dev-email-store";
import {
  getInboundAttachment,
  readRelaybaseWorkerConfig,
} from "@/lib/relaybase/worker-client";

type Params = { params: Promise<{ key: string; attachmentId: string }> };

function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("not found");
}

export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { key, attachmentId } = await params;
    const data = await readUserEmailData(userId);
    const url = new URL(request.url);
    const explicitDomain = normalizeDomain(url.searchParams.get("domain") ?? "");
    const resolved = resolveRequestDomain(request, data);

    if (explicitDomain && !resolved) {
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    const cfg = await readRelaybaseWorkerConfig();
    if (!cfg) {
      return Response.json(
        { error: "Relaybase worker is not configured" },
        { status: 503 },
      );
    }

    const candidates = explicitDomain
      ? [explicitDomain]
      : [
          ...(resolved ? [resolved] : []),
          ...data.domains.filter((d) => d !== resolved),
        ];

    let lastNotFound: Error | null = null;
    for (const domain of candidates) {
      try {
        const upstream = await getInboundAttachment(
          cfg,
          domain,
          key,
          attachmentId,
        );
        const headers = new Headers(upstream.headers);
        headers.set("Cache-Control", "private, max-age=3600");
        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      } catch (error) {
        if (isNotFound(error)) {
          lastNotFound =
            error instanceof Error ? error : new Error("Attachment not found");
          continue;
        }
        throw error;
      }
    }

    return Response.json(
      { error: lastNotFound?.message ?? "Attachment not found" },
      { status: 404 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    if (message.includes("not found")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
