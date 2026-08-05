import fs from "fs";
import path from "path";

import { getRelaybaseAppKv } from "@/lib/cloudflare/kv";

export type UserRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
};

const USERS_INDEX_KEY = "users:_index";
const USERS_FILE = path.join(process.cwd(), "..", "data", "users.json");

function userKvKey(id: string): string {
  return `user:${id}`;
}

function readIndexIdsFromFs(): string[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
    return users.map((u) => u.id);
  } catch {
    return [];
  }
}

function readUserRecordFromFs(id: string): UserRecord | null {
  if (!fs.existsSync(USERS_FILE)) return null;
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
    return users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

async function readIndexIds(): Promise<string[]> {
  const kv = await getRelaybaseAppKv();
  if (kv) {
    const raw = await kv.get(USERS_INDEX_KEY, "text");
    if (raw !== null) {
      return JSON.parse(raw) as string[];
    }
    // OpenNext local/dev binds KV; fall back to monorepo data/ when missing.
  }

  return readIndexIdsFromFs();
}

async function readUserRecord(id: string): Promise<UserRecord | null> {
  const kv = await getRelaybaseAppKv();
  if (kv) {
    const raw = await kv.get(userKvKey(id), "text");
    if (raw !== null) {
      return JSON.parse(raw) as UserRecord;
    }
  }

  return readUserRecordFromFs(id);
}

async function readAll(): Promise<UserRecord[]> {
  const ids = await readIndexIds();
  const records = await Promise.all(ids.map((id) => readUserRecord(id)));
  return records.filter((r): r is UserRecord => r !== null);
}

async function writeIndexIds(ids: string[]): Promise<void> {
  const payload = `${JSON.stringify(ids, null, 2)}\n`;
  const kv = await getRelaybaseAppKv();
  if (kv) {
    await kv.put(USERS_INDEX_KEY, payload);
    return;
  }

  const users = await readAllFromFs();
  const byId = new Map(users.map((u) => [u.id, u]));
  const next = ids
    .map((id) => byId.get(id))
    .filter((u): u is UserRecord => u !== undefined);
  writeAllFs(next);
}

async function readAllFromFs(): Promise<UserRecord[]> {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
  } catch {
    return [];
  }
}

function writeAllFs(users: UserRecord[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

async function writeUserRecord(record: UserRecord): Promise<void> {
  const payload = `${JSON.stringify(record, null, 2)}\n`;
  const kv = await getRelaybaseAppKv();
  if (kv) {
    await kv.put(userKvKey(record.id), payload);
    return;
  }

  const users = await readAllFromFs();
  const index = users.findIndex((u) => u.id === record.id);
  if (index >= 0) {
    users[index] = record;
  } else {
    users.push(record);
  }
  writeAllFs(users);
}

export async function listUsers(): Promise<UserRecord[]> {
  const users = await readAll();
  return users.sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return readUserRecord(trimmed);
}

export async function upsertUser(id: string): Promise<UserRecord> {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("User id is required");

  const now = new Date().toISOString();
  const existing = await readUserRecord(trimmed);
  if (existing) {
    existing.lastSeenAt = now;
    await writeUserRecord(existing);
    return existing;
  }

  const record: UserRecord = { id: trimmed, createdAt: now, lastSeenAt: now };
  await writeUserRecord(record);

  const kv = await getRelaybaseAppKv();
  if (kv) {
    const ids = await readIndexIds();
    if (!ids.includes(trimmed)) {
      await writeIndexIds([...ids, trimmed]);
    }
  }

  return record;
}
