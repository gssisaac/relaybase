import { NextResponse } from "next/server";

import {
  createEmailSenderKey,
  listEmailSenderKeys,
} from "@/relaybase/lib/client";
import { requireRelaybaseAdminAuth, RelaybaseAuthError } from "@/relaybase/lib/auth";
import { apiError } from "@/lib/api/api-error";

function relaybaseApiError(error: unknown) {
  if (error instanceof RelaybaseAuthError) {
    return apiError(error, 401);
  }
  return apiError(error);
}

export async function GET(request: Request) {
  try {
    const cfg = await requireRelaybaseAdminAuth(request);
    const keys = await listEmailSenderKeys(cfg);
    return NextResponse.json({ keys });
  } catch (error) {
    return relaybaseApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { domain?: string; label?: string };
    const domain = body.domain?.trim();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const cfg = await requireRelaybaseAdminAuth(request);
    const result = await createEmailSenderKey(cfg, {
      domain,
      label: body.label,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return relaybaseApiError(error);
  }
}
