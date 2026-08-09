import { NextResponse } from "next/server";

import {
  createAudienceGroup,
  listAudienceGroupSummaries,
  normalizeDomain,
  requireSessionUserId,
  type AudienceDataSourceType,
} from "@/lib/dev-email-store";

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const groups = await listAudienceGroupSummaries(userId);
    const domain = normalizeDomain(
      new URL(request.url).searchParams.get("domain") ?? "",
    );
    return NextResponse.json({
      groups: domain ? groups.filter((g) => g.domain === domain) : groups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

type CreateBody = {
  name?: string;
  domain?: string;
  dataSource?: {
    type?: AudienceDataSourceType;
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
  };
  cronEnabled?: boolean;
  cronIntervalMinutes?: number;
};

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as CreateBody;
    const name = body.name?.trim();
    const domain = body.domain?.trim();
    if (!name || !domain) {
      return NextResponse.json(
        { error: "name and domain are required" },
        { status: 400 },
      );
    }

    const endpointUrl = body.dataSource?.endpointUrl?.trim();
    const dataSource = endpointUrl
      ? {
          type: "generic_json" as const,
          endpointUrl,
          credential: body.dataSource?.credential?.trim() || undefined,
          credentialHeader:
            body.dataSource?.credentialHeader?.trim() || undefined,
        }
      : undefined;

    const { group, syncResult } = await createAudienceGroup(userId, {
      name,
      domain,
      dataSource,
      cronEnabled: body.cronEnabled,
      cronIntervalMinutes: body.cronIntervalMinutes,
    });

    return NextResponse.json({ group, syncResult }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
