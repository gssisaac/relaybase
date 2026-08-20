import fs from "fs";
import path from "path";

export type UserRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
};

const USERS_FILE = path.join(process.cwd(), "..", "..", "data", "users.json");

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

export async function listUsers(): Promise<UserRecord[]> {
  const users = readAllFromFs();
  return users.sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
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
