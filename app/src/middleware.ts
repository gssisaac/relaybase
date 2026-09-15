import { NextRequest, NextResponse } from "next/server";

import { shouldProxyRequestToScale } from "@/lib/scale/scale-proxy-policy";

const DEFAULT_SCALE_UPSTREAM = "http://127.0.0.1:32831";

function scaleUpstreamOrigin(): string {
  return (
    process.env.SCALE_UPSTREAM_URL?.replace(/\/$/, "") ??
    process.env.SCALE_INTERNAL_URL?.replace(/\/$/, "") ??
    process.env.CRM_UPSTREAM_URL?.replace(/\/$/, "") ??
    process.env.CRM_INTERNAL_URL?.replace(/\/$/, "") ??
    DEFAULT_SCALE_UPSTREAM
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/crm(?=\/|$)/, "/scale");
    return NextResponse.redirect(url, 308);
  }

  if (!shouldProxyRequestToScale(pathname, request.method, request.headers)) {
    return NextResponse.next();
  }

  const upstream = scaleUpstreamOrigin();
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
      { error: "Scale upstream unreachable — start hq/scale or set SCALE_UPSTREAM_URL" },
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
  matcher: ["/crm", "/crm/:path*", "/scale/:path*"],
};
