import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { NextResponse } from "next/server";

/**
 * Local-only bridge so `pnpm next` (browser, no Tauri) can read/write
 * ~/.relaybase/credentials.json the same way the desktop shell does.
 * Not deployed — app Worker / OpenNext is decommissioned.
 *
 * Disk allowlist: accountId, workerUrl, adminToken, workerScriptName,
 * workerVersion, plus non-empty relaybaseAccountId / Email / Session.
 * CF OAuth and API tokens are never read from or written to disk.
 */

type DiskCredentials = {
  accountId: string;
  workerUrl: string;
  adminToken: string;
  workerScriptName: string;
  workerVersion: string;
  relaybaseAccountId?: string;
  relaybaseEmail?: string;
  relaybaseSession?: string;
};

const DISK_KEYS = [
  "accountId",
  "workerUrl",
  "adminToken",
  "workerScriptName",
  "workerVersion",
  "relaybaseAccountId",
  "relaybaseEmail",
  "relaybaseSession",
] as const;

function credentialsPath(): string {
  return join(homedir(), ".relaybase", "credentials.json");
}

function emptyOverlay() {
  return {
    installToken: "",
    cfOauthAccessToken: "",
    cfOauthRefreshToken: "",
    cfOauthAccessExpiresAt: "",
    cfOauthAccountId: "",
  };
}

function toDisk(input: Record<string, unknown>): DiskCredentials {
  const str = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string).trim() : "";
  const disk: DiskCredentials = {
    accountId: str("accountId"),
    workerUrl: str("workerUrl").replace(/\/$/, ""),
    adminToken: str("adminToken"),
    workerScriptName: str("workerScriptName"),
    workerVersion: str("workerVersion"),
  };
  const accountId = str("relaybaseAccountId");
  const email = str("relaybaseEmail");
  const session = str("relaybaseSession");
  if (accountId) disk.relaybaseAccountId = accountId;
  if (email) disk.relaybaseEmail = email;
  if (session) disk.relaybaseSession = session;
  return disk;
}

function isDirty(parsed: Record<string, unknown>): boolean {
  for (const key of Object.keys(parsed)) {
    if (!DISK_KEYS.includes(key as (typeof DISK_KEYS)[number])) return true;
  }
  for (const key of ["relaybaseAccountId", "relaybaseEmail", "relaybaseSession"] as const) {
    if (typeof parsed[key] === "string" && !(parsed[key] as string).trim()) {
      return true;
    }
  }
  return false;
}

async function writeDisk(disk: DiskCredentials): Promise<void> {
  const dir = join(homedir(), ".relaybase");
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsPath(), `${JSON.stringify(disk, null, 2)}\n`, {
    mode: 0o600,
  });
}

function toResponse(disk: DiskCredentials) {
  return {
    ...disk,
    relaybaseAccountId: disk.relaybaseAccountId ?? "",
    relaybaseEmail: disk.relaybaseEmail ?? "",
    relaybaseSession: disk.relaybaseSession ?? "",
    ...emptyOverlay(),
  };
}

export async function GET() {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const disk = toDisk(parsed);
    if (isDirty(parsed)) {
      await writeDisk(disk);
    }
    return NextResponse.json(toResponse(disk));
  } catch {
    return NextResponse.json(null);
  }
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const disk = toDisk(body);
  await writeDisk(disk);
  return NextResponse.json(toResponse(disk));
}
