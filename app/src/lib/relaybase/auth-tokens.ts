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

function readTokenRecords(): DashboardAuthTokenRecord[] {
  const stored = readProductJson<RelaybaseSettingsSlice>(
    RELAYBASE_STORE_ID,
    SETTINGS_FILE,
  );
  return stored?.dashboardAuthTokens ?? stored?.dashboardAdminTokens ?? [];
}

function writeTokenRecords(tokens: DashboardAuthTokenRecord[]): void {
  const stored =
    readProductJson<Record<string, unknown>>(RELAYBASE_STORE_ID, SETTINGS_FILE) ??
    {};
  writeProductJson(RELAYBASE_STORE_ID, SETTINGS_FILE, {
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

export function findAuthTokenForUser(userId: string): string | null {
  const match = readTokenRecords().find((entry) => entry.productId === userId);
  return match?.token ?? null;
}

export function issueAuthTokenForUser(userId: string): string {
  const existing = findAuthTokenForUser(userId);
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
  writeTokenRecords([...readTokenRecords(), record]);
  return token;
}

export function isValidAuthToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed.startsWith("rb-auth-")) return false;
  return readTokenRecords().some((entry) => entry.token === trimmed);
}
