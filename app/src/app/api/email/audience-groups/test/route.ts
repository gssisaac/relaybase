import { NextResponse } from "next/server";

import {
  fetchDataSourceContacts,
  mergeAudienceDataSource,
  readUserEmailData,
  requireSessionUserId,
} from "@/lib/dev-email-store";

type TestBody = {
  endpointUrl?: string;
  credential?: string;
  credentialHeader?: string;
  /** When set, blank credential falls back to the group's stored token. */
  groupId?: string;
};

const SAMPLE_LIMIT = 20;

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as TestBody;
    const endpointUrl = body.endpointUrl?.trim();
    if (!endpointUrl) {
      return NextResponse.json(
        { ok: false, error: "Endpoint URL is required" },
        { status: 400 },
      );
    }

    try {
      new URL(endpointUrl);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Endpoint URL is not a valid URL" },
        { status: 400 },
      );
    }

    let previous;
    if (body.groupId?.trim()) {
      const data = await readUserEmailData(userId);
      previous = data.audienceGroups.find(
        (g) => g.id === body.groupId!.trim(),
      )?.dataSource;
    }

    const patch: {
      endpointUrl: string;
      credential?: string;
      credentialHeader?: string;
    } = { endpointUrl };
    if (body.credential?.trim()) {
      patch.credential = body.credential.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, "credentialHeader")) {
      patch.credentialHeader = body.credentialHeader?.trim() || "";
    }

    const dataSource = mergeAudienceDataSource(previous, patch);

    const { contacts, skippedCount } = await fetchDataSourceContacts(dataSource);

    return NextResponse.json({
      ok: true,
      totalCount: contacts.length,
      skippedCount,
      sampleContacts: contacts.slice(0, SAMPLE_LIMIT),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed";
    if (message === "Not signed in") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
