import fs from "fs";
import path from "path";

import { getRelaybaseAppDogfoodKv } from "@/lib/cloudflare/kv";

export type UserRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
};

const USERS_FILE = path.join(process.cwd(), "..", "..", "data", "users.json");
const USERS_INDEX_KEY = "users:_index";

function userKvKey(id: string): string {
  return `user:${id}`;
}

function readAllFromFs(): UserRecord[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
  } catch {
    return [];
  }
}

function writeAllToFs(users: UserRecord[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

async function readAllFromKv(): Promise<UserRecord[]> {
  const kv = await getRelaybaseAppDogfoodKv();
  if (!kv) return readAllFromFs();

  const indexRaw = await kv.get(USERS_INDEX_KEY);
  if (!indexRaw) return [];

  let ids: string[];
  try {
    ids = JSON.parse(indexRaw) as string[];
  } catch {
    return [];
  }

  const users: UserRecord[] = [];
  for (const id of ids) {
    const raw = await kv.get(userKvKey(id));
    if (!raw) continue;
    try {
      users.push(JSON.parse(raw) as UserRecord);
    } catch {
      continue;
    }
  }
  return users;
}

export async function listUsers(): Promise<UserRecord[]> {
  const users = await readAllFromKv();
  return users.sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const kv = await getRelaybaseAppDogfoodKv();
  if (kv) {
    const raw = await kv.get(userKvKey(trimmed));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserRecord;
    } catch {
      return null;
    }
  }

  return readAllFromFs().find((user) => user.id === trimmed) ?? null;
}

export async function upsertUser(id: string): Promise<UserRecord> {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("User id is required");

  const users = readAllFromFs();
  const now = new Date().toISOString();
  const existing = users.find((u) => u.id === trimmed);
  if (existing) {
    existing.lastSeenAt = now;
    writeAllToFs(users);
    return existing;
  }

  const record: UserRecord = { id: trimmed, createdAt: now, lastSeenAt: now };
  users.push(record);
  writeAllToFs(users);
  return record;
}
