import { NextResponse } from "next/server";

import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import { readEmailSenderSettings } from "@/relaybase/lib/settings";

/**
 * License admin now lives in the console.relaybase.xyz Next.js app (see console/),
 * not on the product Worker. The Worker no longer serves /v1/license/* after the
 * central-server split. These admin routes proxy to console's /v1/license/admin.
 */
async function consoleConfig() {
  const env = readRelaybaseEnvSettings();
  const stored = await readEmailSenderSettings();
  const baseUrl = (
    process.env.RELAYBASE_CONSOLE_URL?.trim() ||
    "https://console.relaybase.xyz"
  ).replace(/\/$/, "");
  const adminToken = stored.adminToken?.trim() || "";
  if (!adminToken) {
    throw new Error("Admin token not configured");
  }
  return { baseUrl, adminToken };
}

export async function GET() {
  try {
    const { baseUrl, adminToken } = await consoleConfig();
    const res = await fetch(`${baseUrl}/v1/license/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { baseUrl, adminToken } = await consoleConfig();
    const res = await fetch(`${baseUrl}/v1/license/admin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const { baseUrl, adminToken } = await consoleConfig();
    const res = await fetch(`${baseUrl}/v1/license/admin/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
