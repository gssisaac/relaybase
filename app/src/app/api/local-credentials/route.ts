import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";

/**
 * Local-only bridge so `pnpm next` (browser, no Tauri) can read/write
 * ~/.relaybase/credentials.json the same way the desktop shell does.
 * Not deployed — app Worker / OpenNext is decommissioned.
 */

type CredentialsFile = {
  accountId?: string;
  apiToken?: string;
  workerUrl?: string;
  adminToken?: string;
  workerScriptName?: string;
  licenseKey?: string;
};

function credentialsPath(): string {
  return join(homedir(), ".relaybase", "credentials.json");
}

export async function GET() {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = JSON.parse(raw) as CredentialsFile;
    return NextResponse.json({
      accountId: parsed.accountId ?? "",
      apiToken: parsed.apiToken ?? "",
      workerUrl: parsed.workerUrl ?? "",
      adminToken: parsed.adminToken ?? "",
      workerScriptName: parsed.workerScriptName ?? "",
      licenseKey: parsed.licenseKey ?? "",
    });
  } catch {
    return NextResponse.json(null);
  }
}

export async function PUT(req: Request) {
  let body: CredentialsFile;
  try {
    body = (await req.json()) as CredentialsFile;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const dir = join(homedir(), ".relaybase");
  await mkdir(dir, { recursive: true });
  const next: CredentialsFile = {
    accountId: body.accountId?.trim() ?? "",
    apiToken: body.apiToken?.trim() ?? "",
    workerUrl: body.workerUrl?.trim().replace(/\/$/, "") ?? "",
    adminToken: body.adminToken?.trim() ?? "",
    workerScriptName: body.workerScriptName?.trim() ?? "",
    licenseKey: body.licenseKey?.trim() ?? "",
  };
  await writeFile(credentialsPath(), `${JSON.stringify(next, null, 2)}\n`, {
    mode: 0o600,
  });
  return NextResponse.json(next);
}
