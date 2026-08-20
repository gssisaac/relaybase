import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";

/**
 * Local-only bridge so `pnpm next` (browser, no Tauri) can read/write
 * ~/.relaybase/credentials.json the same way the desktop shell does.
 * Not deployed — app Worker / OpenNext is decommissioned.
 *
 * CF OAuth install tokens are never read from or written to disk — they live
 * in Tauri process memory only. Responses always return empty OAuth fields.
 */

type CredentialsFile = {
  accountId?: string;
  /** Legacy single-token field; migrated to installToken on read. */
  apiToken?: string;
  installToken?: string;
  serverToken?: string;
  serverTokenPushedAt?: string;
  workerUrl?: string;
  adminToken?: string;
  workerScriptName?: string;
  licenseKey?: string;
  relaybaseAccountId?: string;
  relaybaseEmail?: string;
  relaybaseSession?: string;
  relaybaseTier?: string;
  // Legacy — stripped on read/write; OAuth is memory-only in Tauri.
  cfOauthAccessToken?: string;
  cfOauthRefreshToken?: string;
  cfOauthAccessExpiresAt?: string;
  cfOauthAccountId?: string;
};

function credentialsPath(): string {
  return join(homedir(), ".relaybase", "credentials.json");
}

function stripLegacyOAuthFields(parsed: CredentialsFile): CredentialsFile {
  const next = { ...parsed };
  delete next.cfOauthAccessToken;
  delete next.cfOauthRefreshToken;
  delete next.cfOauthAccessExpiresAt;
  delete next.cfOauthAccountId;
  // OAuth-sourced install tokens must not persist on disk.
  if (parsed.cfOauthAccessToken || parsed.cfOauthRefreshToken) {
    next.installToken = "";
    next.apiToken = "";
  }
  return next;
}

export async function GET() {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = stripLegacyOAuthFields(JSON.parse(raw) as CredentialsFile);
    return NextResponse.json({
      accountId: parsed.accountId ?? "",
      // Migrate legacy apiToken → installToken on read.
      installToken: parsed.installToken ?? parsed.apiToken ?? "",
      serverToken: parsed.serverToken ?? "",
      serverTokenPushedAt: parsed.serverTokenPushedAt ?? "",
      workerUrl: parsed.workerUrl ?? "",
      adminToken: parsed.adminToken ?? "",
      workerScriptName: parsed.workerScriptName ?? "",
      licenseKey: parsed.licenseKey ?? "",
      relaybaseAccountId: parsed.relaybaseAccountId ?? "",
      relaybaseEmail: parsed.relaybaseEmail ?? "",
      relaybaseSession: parsed.relaybaseSession ?? "",
      relaybaseTier: parsed.relaybaseTier ?? "",
      cfOauthAccessToken: "",
      cfOauthRefreshToken: "",
      cfOauthAccessExpiresAt: "",
      cfOauthAccountId: "",
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
  const next = stripLegacyOAuthFields({
    accountId: body.accountId?.trim() ?? "",
    installToken: body.installToken?.trim() ?? "",
    serverToken: body.serverToken?.trim() ?? "",
    serverTokenPushedAt: body.serverTokenPushedAt?.trim() ?? "",
    workerUrl: body.workerUrl?.trim().replace(/\/$/, "") ?? "",
    adminToken: body.adminToken?.trim() ?? "",
    workerScriptName: body.workerScriptName?.trim() ?? "",
    licenseKey: body.licenseKey?.trim() ?? "",
    relaybaseAccountId: body.relaybaseAccountId?.trim() ?? "",
    relaybaseEmail: body.relaybaseEmail?.trim() ?? "",
    relaybaseSession: body.relaybaseSession?.trim() ?? "",
    relaybaseTier: body.relaybaseTier?.trim() ?? "",
  });
  await writeFile(credentialsPath(), `${JSON.stringify(next, null, 2)}\n`, {
    mode: 0o600,
  });
  return NextResponse.json({
    ...next,
    cfOauthAccessToken: "",
    cfOauthRefreshToken: "",
    cfOauthAccessExpiresAt: "",
    cfOauthAccountId: "",
  });
}
