import fs from "fs";
import path from "path";

export type DevEmailConfig = {
  domain: string;
  cloudflareConfigured: boolean;
  relaybaseConfigured: boolean;
};

export type DevUserEmailData = {
  config: DevEmailConfig;
  addresses: { email: string }[];
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

function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

function dataFile(userId: string): string {
  return path.join(
    process.cwd(),
    "..",
    "..",
    "data",
    "users",
    `${safeUserId(userId)}.json`,
  );
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

function readUserEmailDataFromFs(userId: string): DevUserEmailData {
  const file = dataFile(userId);
  if (!fs.existsSync(file)) return emptyData();
  try {
    return { ...emptyData(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return emptyData();
  }
}

export async function readUserEmailData(
  userId: string,
): Promise<DevUserEmailData> {
  return readUserEmailDataFromFs(userId);
}

export async function resolveUserDomain(
  userId: string,
): Promise<string | null> {
  const domain = (await readUserEmailData(userId)).config.domain
    ?.trim()
    .toLowerCase();
  if (!domain || domain === "example.com") return null;
  return domain;
}
