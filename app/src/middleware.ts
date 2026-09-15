import { NextRequest, NextResponse } from "next/server";

import { shouldProxyRequestToCrm } from "@/lib/crm/crm-proxy-policy";

const DEFAULT_CRM_UPSTREAM = "http://127.0.0.1:32831";

function crmUpstreamOrigin(): string {
  return (
    process.env.CRM_UPSTREAM_URL?.replace(/\/$/, "") ??
    process.env.CRM_INTERNAL_URL?.replace(/\/$/, "") ??
    DEFAULT_CRM_UPSTREAM
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!shouldProxyRequestToCrm(pathname, request.method, request.headers)) {
    return NextResponse.next();
  }

  const upstream = crmUpstreamOrigin();
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
      { error: "CRM upstream unreachable — start hq/crm or set CRM_UPSTREAM_URL" },
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
  matcher: ["/crm/:path*"],
};
