import { NextResponse } from "next/server";

import {
  addUserDomain,
  listDomainSummaries,
  markDomainR2Provisioned,
  normalizeDomain,
  readUserEmailData,
  removeUserDomain,
  requireSessionUserId,
  setActiveUserDomain,
} from "@/lib/dev-email-store";
import { provisionDomainInboundR2 } from "@/lib/relaybase/provision-domain-r2";

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    return NextResponse.json({
      domains: listDomainSummaries(data),
      activeDomain: data.config.activeDomain,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { domain?: string };
    const domain = normalizeDomain(body.domain ?? "");
    addUserDomain(userId, domain);

    let r2Message: string | null = null;
    let r2Error: string | null = null;
    let r2: Awaited<ReturnType<typeof provisionDomainInboundR2>> | null = null;

    try {
      r2 = await provisionDomainInboundR2(domain);
      markDomainR2Provisioned(userId, r2);
      r2Message = r2.message;
    } catch (error) {
      r2Error =
        error instanceof Error
          ? error.message
          : "Failed to provision inbound R2 bucket";
    }

    const data = readUserEmailData(userId);
    return NextResponse.json({
      domains: listDomainSummaries(data),
      activeDomain: data.config.activeDomain,
      r2: r2
        ? {
            bucketName: r2.bucketName,
            objectPrefix: r2.objectPrefix,
            created: r2.bucketCreated,
            workerReady: r2.workerReady,
            workerBucketName: r2.workerBucketName,
          }
        : null,
      r2Error,
      message: r2Message
        ? `Domain added. ${r2Message}`
        : r2Error
          ? `Domain added, but R2 provisioning failed: ${r2Error}`
          : "Domain added",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message.includes("required") ? 400 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { activeDomain?: string };
    const activeDomain = body.activeDomain?.trim();
    if (!activeDomain) {
      return NextResponse.json(
        { error: "activeDomain is required" },
        { status: 400 },
      );
    }
    const data = setActiveUserDomain(userId, activeDomain);
    return NextResponse.json({
      domains: listDomainSummaries(data),
      activeDomain: data.config.activeDomain,
      message: "Active domain updated",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status = message.includes("not found") ? 404 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    const data = removeUserDomain(userId, domain);
    return NextResponse.json({
      domains: listDomainSummaries(data),
      activeDomain: data.config.activeDomain,
      message: "Domain removed",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
