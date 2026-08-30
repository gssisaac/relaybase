import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/api-error";
import { createLicense, listLicenses, revokeLicense } from "@/lib/licenses";

/**
 * Operator license admin. Reads/writes strum-relaybase-ops.licenses directly — same D1
 * as console verify + Stripe. Does not hop through console.relaybase.xyz.
 */
export async function GET() {
  try {
    const result = await listLicenses();
    if (!result.available) {
      return NextResponse.json(
        { licenses: [], error: result.message ?? "Licenses unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json({ licenses: result.licenses });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; note?: string };
    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    const { record, licenseKey } = await createLicense({
      email: body.email,
      note: body.note ?? "manual-admin",
    });
    return NextResponse.json({ record, licenseKey });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const ok = await revokeLicense(id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return apiError(error);
  }
}
