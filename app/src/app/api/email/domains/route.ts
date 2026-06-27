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
import {
  classifyProvisionFailure,
  duplicateDomainError,
  DomainProvisionError,
  logDomainProvisionFailure,
  validationDomainError,
} from "@/lib/relaybase/domain-provision-errors";
import { provisionDomainInboundR2 } from "@/lib/relaybase/provision-domain-r2";

function isPlaceholderDomain(domain: string): boolean {
  return !domain || domain === "example.com";
}

function provisionErrorResponse(
  userId: string,
  domain: string,
  error: DomainProvisionError,
) {
  logDomainProvisionFailure({ userId, domain, error });
  return NextResponse.json(
    {
      error: error.userMessage,
      code: error.kind,
    },
    { status: error.status },
  );
}

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
  let userId = "";
  let domain = "";

  try {
    userId = await requireSessionUserId();
    const body = (await request.json()) as { domain?: string };
    domain = normalizeDomain(body.domain ?? "");

    if (!domain || isPlaceholderDomain(domain)) {
      throw validationDomainError("Enter a valid domain, such as example.com.");
    }

    const existing = readUserEmailData(userId);
    if (existing.domains.includes(domain)) {
      throw duplicateDomainError(domain);
    }

    const r2 = await provisionDomainInboundR2(domain);
    addUserDomain(userId, domain);
    markDomainR2Provisioned(userId, r2);

    const data = readUserEmailData(userId);
    return NextResponse.json({
      domains: listDomainSummaries(data),
      activeDomain: data.config.activeDomain,
      r2: {
        bucketName: r2.bucketName,
        objectPrefix: r2.objectPrefix,
        created: r2.bucketCreated,
        workerReady: r2.workerReady,
        workerBucketName: r2.workerBucketName,
      },
      message: r2.bucketCreated
        ? `Added ${domain}. Created inbound storage bucket ${r2.bucketName}.`
        : `Added ${domain}. Inbound storage on ${r2.bucketName} is ready.`,
    });
  } catch (error) {
    if (userId && domain) {
      try {
        const data = readUserEmailData(userId);
        if (data.domains.includes(domain)) {
          removeUserDomain(userId, domain);
        }
      } catch (rollbackError) {
        console.error("[domain-provision] rollback failed", {
          userId,
          domain,
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : rollbackError,
        });
      }
    }

    const classified = classifyProvisionFailure(error);
    if (userId && domain) {
      return provisionErrorResponse(userId, domain, classified);
    }

    const message = classified.userMessage;
    const status = classified.status;
    return NextResponse.json({ error: message, code: classified.kind }, { status });
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
