import { NextResponse } from "next/server";

import {
  deleteAudienceGroup,
  getAudienceGroupDetail,
  requireSessionUserId,
  updateAudienceGroup,
  type AudienceDataSourceType,
} from "@/lib/dev-email-store";

type Params = { params: Promise<{ groupId: string }> };

function errorStatus(message: string): number {
  if (message === "Not signed in") return 401;
  if (message.includes("not found")) return 404;
  return 400;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const detail = await getAudienceGroupDetail(userId, groupId);
    if (!detail) {
      return NextResponse.json(
        { error: "Audience group not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

type PatchBody = {
  name?: string;
  defaultFrom?: string | null;
  cronEnabled?: boolean;
  cronIntervalMinutes?: number;
  dataSource?: {
    type?: AudienceDataSourceType;
    endpointUrl?: string;
    credential?: string;
    credentialHeader?: string;
  } | null;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    const body = (await request.json()) as PatchBody;

    const patch: Parameters<typeof updateAudienceGroup>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.defaultFrom !== undefined) {
      patch.defaultFrom = body.defaultFrom?.trim() || undefined;
    }
    if (body.cronEnabled !== undefined) patch.cronEnabled = body.cronEnabled;
    if (body.cronIntervalMinutes !== undefined) {
      patch.cronIntervalMinutes = body.cronIntervalMinutes;
    }
    if (body.dataSource !== undefined) {
      if (!body.dataSource?.endpointUrl?.trim()) {
        patch.dataSource = null;
      } else {
        const next: NonNullable<typeof patch.dataSource> = {
          endpointUrl: body.dataSource.endpointUrl.trim(),
        };
        // Only include credential when the client sent a non-empty value —
        // empty/omitted means "keep the stored token".
        if (body.dataSource.credential?.trim()) {
          next.credential = body.dataSource.credential.trim();
        }
        if (
          Object.prototype.hasOwnProperty.call(body.dataSource, "credentialHeader")
        ) {
          next.credentialHeader = body.dataSource.credentialHeader?.trim() || "";
        }
        patch.dataSource = next;
      }
    }

    const group = await updateAudienceGroup(userId, groupId, patch);
    return NextResponse.json({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireSessionUserId();
    const { groupId } = await params;
    await deleteAudienceGroup(userId, groupId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
