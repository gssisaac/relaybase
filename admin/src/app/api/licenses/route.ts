import { NextResponse } from "next/server";

import { readRelaybaseEnvSettings } from "@/relaybase/lib/env-settings";
import { readEmailSenderSettings } from "@/relaybase/lib/settings";

async function workerConfig() {
  const env = readRelaybaseEnvSettings();
  const stored = await readEmailSenderSettings();
  const baseUrl = (env.workerUrl || stored.workerUrl || "").replace(/\/$/, "");
  const adminToken = stored.adminToken?.trim() || "";
  if (!baseUrl || !adminToken) {
    throw new Error("Worker URL / admin token not configured");
  }
  return { baseUrl, adminToken };
}

export async function GET() {
  try {
    const { baseUrl, adminToken } = await workerConfig();
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
    const { baseUrl, adminToken } = await workerConfig();
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
    const { baseUrl, adminToken } = await workerConfig();
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
