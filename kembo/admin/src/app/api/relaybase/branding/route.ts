import { NextResponse } from "next/server";

import {
  applyDomainBrandingDns,
  fetchDomainBrandingStatus,
  mergeDomainBrandingConfig,
} from "@/relaybase/lib/branding";
import { apiError } from "@/lib/api/api-error";

/**
 * DMARC branding now lives on the product worker (`/console/branding`,
 * D1 `domain_branding`). These admin routes are a thin proxy so the
 * existing admin UI keeps its shape.
 */
export async function GET(request: Request) {
  try {
    const domain = new URL(request.url).searchParams.get("domain")?.trim();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    const status = await fetchDomainBrandingStatus(domain);
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: string;
      dmarcPolicy?: "none" | "quarantine" | "reject";
      dmarcRua?: string;
    };
    const domain = body.domain?.trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const status = await mergeDomainBrandingConfig(domain, {
      dmarcPolicy: body.dmarcPolicy,
      dmarcRua: body.dmarcRua,
    });
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { domain?: string };
    const domain = body.domain?.trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const status = await applyDomainBrandingDns(domain);
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error);
  }
}
