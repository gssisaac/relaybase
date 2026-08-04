import { randomBytes } from "node:crypto";

import {
  readProductJson,
  writeProductJson,
} from "@/lib/config/product-store";

const RELAYBASE_STORE_ID = "relaybase";
const SETTINGS_FILE = "settings.json";

type DashboardAuthTokenRecord = {
  id: string;
  label: string | null;
  productId: string | null;
  tokenPrefix: string;
  token: string;
  createdAt: string;
};

type RelaybaseSettingsSlice = {
  dashboardAuthTokens?: DashboardAuthTokenRecord[];
  dashboardAdminTokens?: DashboardAuthTokenRecord[];
};

async function readTokenRecords(): Promise<DashboardAuthTokenRecord[]> {
  const stored = await readProductJson<RelaybaseSettingsSlice>(
    RELAYBASE_STORE_ID,
    SETTINGS_FILE,
  );
  return stored?.dashboardAuthTokens ?? stored?.dashboardAdminTokens ?? [];
}

async function writeTokenRecords(tokens: DashboardAuthTokenRecord[]): Promise<void> {
  const stored =
    (await readProductJson<Record<string, unknown>>(RELAYBASE_STORE_ID, SETTINGS_FILE)) ??
    {};
  await writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
    ...stored,
    dashboardAuthTokens: tokens,
  });
}

function generateAuthToken(): string {
  return `rb-auth-${randomBytes(24).toString("hex")}`;
}

function authTokenPrefix(token: string): string {
  return token.slice("rb-auth-".length, "rb-auth-".length + 8);
}

export async function findAuthTokenForUser(userId: string): Promise<string | null> {
  const match = (await readTokenRecords()).find((entry) => entry.productId === userId);
  return match?.token ?? null;
}

export async function issueAuthTokenForUser(userId: string): Promise<string> {
  const existing = await findAuthTokenForUser(userId);
  if (existing) return existing;

  const token = generateAuthToken();
  const record: DashboardAuthTokenRecord = {
    id: crypto.randomUUID(),
    label: `${userId} dashboard`,
    productId: userId,
    tokenPrefix: authTokenPrefix(token),
    token,
    createdAt: new Date().toISOString(),
  };
  await writeTokenRecords([...(await readTokenRecords()), record]);
  return token;
}

export async function isValidAuthToken(token: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed.startsWith("rb-auth-")) return false;
  return (await readTokenRecords()).some((entry) => entry.token === trimmed);
}
