import { NextResponse } from "next/server";

import {
  addUserDomain,
  listDomainSummaries,
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
import { startDomainOnboarding } from "@/lib/relaybase/domain-onboard";

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
    const data = await readUserEmailData(userId);
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

    const existing = await readUserEmailData(userId);
    if (existing.domains.includes(domain)) {
      throw duplicateDomainError(domain);
    }

    await addUserDomain(userId, domain);
    const onboard = await startDomainOnboarding(userId, domain);

    return NextResponse.json({
      domains: onboard.domains,
      activeDomain: onboard.activeDomain,
      onboarding: onboard.onboarding,
      message: onboard.message.startsWith(domain)
        ? onboard.message
        : `Added ${domain}. ${onboard.message}`,
    });
  } catch (error) {
    if (userId && domain) {
      try {
        const data = await readUserEmailData(userId);
        if (data.domains.includes(domain) && !data.domainOnboarding?.[domain]) {
          await removeUserDomain(userId, domain);
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

    return NextResponse.json(
      { error: classified.userMessage, code: classified.kind },
      { status: classified.status },
    );
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
    const data = await setActiveUserDomain(userId, activeDomain);
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
    const data = await removeUserDomain(userId, domain);
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
