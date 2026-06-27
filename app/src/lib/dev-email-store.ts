import fs from "fs";
import path from "path";

import { cookies } from "next/headers";

export type DevEmailConfig = {
  domain: string;
  cloudflareConfigured: boolean;
  relaybaseConfigured: boolean;
};

export type DevAddress = { email: string };

export type DevUserEmailData = {
  config: DevEmailConfig;
  addresses: DevAddress[];
  audience: { email: string; name?: string }[];
  broadcasts: {
    id: string;
    subject: string;
    status: string;
    createdAt: string;
  }[];
  sent: {
    id: string;
    from: string;
    to: string;
    subject: string;
    sentAt: string;
  }[];
};

function dataFile(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9@._-]/g, "_");
  return path.join(process.cwd(), "..", "data", "users", `${safe}.json`);
}

function emptyData(): DevUserEmailData {
  return {
    config: {
      domain: "example.com",
      cloudflareConfigured: false,
      relaybaseConfigured: false,
    },
    addresses: [],
    audience: [],
    broadcasts: [],
    sent: [],
  };
}

export function readUserEmailData(userId: string): DevUserEmailData {
  const file = dataFile(userId);
  if (!fs.existsSync(file)) return emptyData();
  try {
    return { ...emptyData(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return emptyData();
  }
}

export function writeUserEmailData(
  userId: string,
  data: DevUserEmailData,
): void {
  const file = dataFile(userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function requireSessionUserId(): Promise<string> {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) throw new Error("Not signed in");
  return userId;
}
