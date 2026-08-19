import { NextResponse } from "next/server";

import {
  issueAuthTokenViaWorker,
  listAuthTokensFromWorker,
} from "@/relaybase/lib/auth-token-client";
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
    const tokens = await listAuthTokensFromWorker(cfg);
    return NextResponse.json({ tokens });
  } catch (error) {
    return relaybaseApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: string;
      productId?: string;
    };
    const cfg = await requireRelaybaseAdminAuth(request);
    const record = await issueAuthTokenViaWorker(cfg, {
      label: body.label,
      productId: body.productId,
    });
    return NextResponse.json(
      {
        id: record.id,
        label: record.label,
        productId: record.productId,
        tokenPrefix: record.tokenPrefix,
        createdAt: record.createdAt,
        token: record.token,
        message:
          "Auth token issued — copy it now; it will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    return relaybaseApiError(error);
  }
}
