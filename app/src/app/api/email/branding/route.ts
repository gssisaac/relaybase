import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import {
  applyDomainBrandingDns,
  fetchDomainBrandingStatus,
  upsertDomainBranding,
} from "@/lib/relaybase/branding";

export async function GET(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const data = readUserEmailData(userId);
    const domain =
      new URL(request.url).searchParams.get("domain")?.trim().toLowerCase() ||
      resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    if (!data.domains.includes(domain)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const status = await fetchDomainBrandingStatus(data, domain);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      domain?: string;
      dmarcPolicy?: "none" | "quarantine" | "reject";
      dmarcRua?: string;
      bimiLogoUrl?: string;
      vmcUrl?: string | null;
    };
    const data = readUserEmailData(userId);
    const domain =
      body.domain?.trim().toLowerCase() || resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    if (!data.domains.includes(domain)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    upsertDomainBranding(data, domain, {
      dmarcPolicy: body.dmarcPolicy,
      dmarcRua: body.dmarcRua,
      bimiLogoUrl: body.bimiLogoUrl,
      vmcUrl:
        body.vmcUrl === null
          ? ""
          : typeof body.vmcUrl === "string"
            ? body.vmcUrl
            : undefined,
    });
    writeUserEmailData(userId, data);

    const status = await fetchDomainBrandingStatus(data, domain);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as {
      domain?: string;
      applyDmarc?: boolean;
      applyBimi?: boolean;
    };
    const data = readUserEmailData(userId);
    const domain =
      body.domain?.trim().toLowerCase() || resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    if (!data.domains.includes(domain)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const status = await applyDomainBrandingDns(data, {
      domain,
      applyDmarc: body.applyDmarc,
      applyBimi: body.applyBimi,
    });
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    const status =
      message.includes("not configured") || message.includes("Could not resolve")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
