import { NextRequest, NextResponse } from "next/server";

import { shouldProxyRequestToStudio } from "@/studio/lib/studio-proxy/studio-proxy-policy";

/** hq/studio dev server — not 32831 (desktop OAuth loopback). */
const DEFAULT_STUDIO_UPSTREAM = "http://127.0.0.1:32832";

function studioUpstreamOrigin(): string {
  const configured =
    process.env.STUDIO_UPSTREAM_URL?.replace(/\/$/, "") ??
    process.env.STUDIO_INTERNAL_URL?.replace(/\/$/, "");
  if (configured) {
    // Stale local env often still points at desktop OAuth loopback (:32831).
    if (
      process.env.NODE_ENV === "development" &&
      /:32831(?:\/|$)/.test(configured)
    ) {
      return DEFAULT_STUDIO_UPSTREAM;
    }
    return configured;
  }
  return DEFAULT_STUDIO_UPSTREAM;
}

function shouldProxyToStudioUpstream(pathname: string, method: string, headers: Headers): boolean {
  if (pathname.startsWith("/auth/")) return true;
  return shouldProxyRequestToStudio(pathname, method, headers);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!shouldProxyToStudioUpstream(pathname, request.method, request.headers)) {
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
  matcher: ["/studio/:path*", "/auth/:path*"],
};
