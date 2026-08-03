import { NextResponse } from "next/server";

import {
  readUserEmailData,
  requireSessionUserId,
  resolveRequestDomain,
  writeUserEmailData,
} from "@/lib/dev-email-store";
import {
  autoSyncDomainBranding,
  publicAssetOrigin,
  readLocalVerificationFile,
  upsertDomainBranding,
  writeLocalVerificationFile,
} from "@/lib/relaybase/branding";

const MAX_UPLOAD_BYTES = 50_000;

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

    const file = readLocalVerificationFile(domain);
    if (!file) {
      return NextResponse.json({ error: "Verification file not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/x-pem-file",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

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
        { error: "That file is too large to be a verification file" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    writeLocalVerificationFile(domain, bytes);

    const publicUrl = `${publicAssetOrigin(request)}/api/email/branding/public/${encodeURIComponent(domain)}/verification.pem`;
    upsertDomainBranding(data, domain, { vmcUrl: publicUrl });
    writeUserEmailData(userId, data);

    const status = await autoSyncDomainBranding(data, domain);
    return NextResponse.json({
      ...status,
      message: "Verification file saved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
