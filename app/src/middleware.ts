import { NextRequest, NextResponse } from "next/server";

import { shouldProxyRequestToStudio } from "@/lib/studio/studio-proxy-policy";

const DEFAULT_STUDIO_UPSTREAM = "http://127.0.0.1:32831";

function studioUpstreamOrigin(): string {
  return (
    process.env.STUDIO_UPSTREAM_URL?.replace(/\/$/, "") ??
    process.env.STUDIO_INTERNAL_URL?.replace(/\/$/, "") ??
    DEFAULT_STUDIO_UPSTREAM
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!shouldProxyRequestToStudio(pathname, request.method, request.headers)) {
    return NextResponse.next();
  }

  const upstream = studioUpstreamOrigin();
  const target = `${upstream}${pathname}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: "Studio upstream unreachable — start hq/studio or set STUDIO_UPSTREAM_URL" },
      { status: 502 },
    );
  }

  const outHeaders = new Headers(upstreamRes.headers);
  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: outHeaders,
  });
}

export const config = {
  matcher: ["/studio/:path*"],
};
