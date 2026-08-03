import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import {
  autoSyncDomainBranding,
  buildLogoSvgFromUpload,
  detectLogoMimeType,
  publicAssetOrigin,
  readLocalBrandingLogo,
  upsertDomainBranding,
  writeLocalBrandingLogo,
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

    const logo = readLocalBrandingLogo(domain);
    if (!logo) {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(logo), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

const MAX_UPLOAD_BYTES = 2_000_000;

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const form = await request.formData();
    const domainValue = String(form.get("domain") ?? "").trim().toLowerCase();
    const data = readUserEmailData(userId);
    const domain = domainValue || resolveRequestDomain(request, data);
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }
    if (!data.domains.includes(domain)) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Please upload an image under 2MB" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = detectLogoMimeType(bytes);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Upload a PNG, JPG, or SVG image" },
        { status: 400 },
      );
    }
    if (mimeType === "image/svg+xml" && !bytes.toString("utf8").includes("<svg")) {
      return NextResponse.json({ error: "That file isn't a valid image" }, { status: 400 });
    }

    const svg = buildLogoSvgFromUpload(bytes, mimeType);
    writeLocalBrandingLogo(domain, svg);

    const publicUrl = `${publicAssetOrigin(request)}/api/email/branding/public/${encodeURIComponent(domain)}/logo.svg`;
    upsertDomainBranding(data, domain, { bimiLogoUrl: publicUrl });
    writeUserEmailData(userId, data);

    const status = await autoSyncDomainBranding(data, domain);
    return NextResponse.json({
      ...status,
      message: "Logo saved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
