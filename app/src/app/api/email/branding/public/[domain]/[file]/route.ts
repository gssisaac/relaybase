import { NextResponse } from "next/server";

import {
  readLocalBrandingLogo,
  readLocalVerificationFile,
} from "@/lib/relaybase/branding";

/**
 * Publicly reachable, unauthenticated by design — this is what mailbox
 * providers (Gmail, Apple Mail, etc.) fetch to display the logo, so it must
 * be servable without a Relaybase session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string; file: string }> },
) {
  const { domain: rawDomain, file } = await params;
  const domain = decodeURIComponent(rawDomain).trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (file === "logo.svg") {
    const logo = readLocalBrandingLogo(domain);
    if (!logo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(logo), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (file === "verification.pem") {
    const pem = readLocalVerificationFile(domain);
    if (!pem) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(pem), {
      headers: {
        "Content-Type": "application/x-pem-file",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
