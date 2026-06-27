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

export function resolveUserDomain(userId: string): string | null {
  const domain = readUserEmailData(userId).config.domain?.trim().toLowerCase();
  if (!domain || domain === "example.com") return null;
  return domain;
}
