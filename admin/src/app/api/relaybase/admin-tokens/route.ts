import { NextResponse } from "next/server";

import {
  issueRelaybaseDashboardAdminToken,
  listRelaybaseDashboardAdminTokens,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

export async function GET() {
  try {
    return NextResponse.json({
      tokens: listRelaybaseDashboardAdminTokens(),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: string;
      productId?: string;
    };
    const { record, token } = issueRelaybaseDashboardAdminToken({
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
        token,
        message:
          "Dashboard admin token issued — copy it now; it will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
