import fs from "fs";
import path from "path";

export type UserRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
};

const USERS_FILE = path.join(process.cwd(), "..", "data", "users.json");

function readAll(): UserRecord[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
  } catch {
    return [];
  }
}

function writeAll(users: UserRecord[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

export function listUsers(): UserRecord[] {
  return readAll().sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export function upsertUser(id: string): UserRecord {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("User id is required");

  const users = readAll();
  const now = new Date().toISOString();
  const existing = users.find((u) => u.id === trimmed);
  if (existing) {
    existing.lastSeenAt = now;
    writeAll(users);
    return existing;
  }

  const record: UserRecord = { id: trimmed, createdAt: now, lastSeenAt: now };
  users.push(record);
  writeAll(users);
  return record;
}
