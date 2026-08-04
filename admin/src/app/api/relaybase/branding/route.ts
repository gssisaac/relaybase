import { NextResponse } from "next/server";

import {
  applyDomainBrandingDns,
  fetchDomainBrandingStatus,
} from "@/relaybase/lib/branding";
import {
  mergeEmailSenderSettings,
  readEmailSenderSettings,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

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

    const current = await readEmailSenderSettings();
    const existing = current.domainBranding[domain] ?? {
      dmarcPolicy: "quarantine" as const,
      dmarcRua: `dmarc@${domain}`,
    };

    const nextConfig = {
      dmarcPolicy: body.dmarcPolicy ?? existing.dmarcPolicy,
      dmarcRua: body.dmarcRua?.trim() || existing.dmarcRua,
    };

    await mergeEmailSenderSettings({
      domainBranding: {
        ...current.domainBranding,
        [domain]: nextConfig,
      },
    });

    const status = await fetchDomainBrandingStatus(domain);
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

    const status = await applyDomainBrandingDns({ domain });
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error);
  }
}
