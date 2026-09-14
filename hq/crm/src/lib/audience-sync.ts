import type { AudienceDataSource } from "../db/types";

export type ParsedContact = { email: string; name: string | null };

const WRAPPER_KEYS = ["contacts", "data", "items", "results"] as const;

export function parseContactsPayload(body: unknown): {
  contacts: ParsedContact[];
  skipped: number;
} {
  let rows: unknown[] | null = null;
  if (Array.isArray(body)) {
    rows = body;
  } else if (body && typeof body === "object") {
    for (const key of WRAPPER_KEYS) {
      const value = (body as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        rows = value;
        break;
      }
    }
  }
  if (!rows) {
    throw new Error("Response must be a JSON array or an object with a contacts/data/items/results array");
  }

  const contacts: ParsedContact[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      skipped += 1;
      continue;
    }
    const email = String((row as { email?: string }).email ?? "")
      .trim()
      .toLowerCase();
    if (!email.includes("@")) {
      skipped += 1;
      continue;
    }
    if (seen.has(email)) {
      skipped += 1;
      continue;
    }
    seen.add(email);
    const rawName = (row as { name?: string }).name;
    contacts.push({
      email,
      name: typeof rawName === "string" ? rawName.trim() || null : null,
    });
  }

  return { contacts, skipped };
}

export async function fetchDataSourceContacts(
  dataSource: AudienceDataSource,
): Promise<{ contacts: ParsedContact[]; skipped: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (dataSource.credential?.trim()) {
    const headerName = dataSource.credentialHeader?.trim() || "Authorization";
    const token = dataSource.credential.trim();
    headers[headerName] =
      headerName.toLowerCase() === "authorization" && !token.toLowerCase().startsWith("bearer ")
        ? `Bearer ${token}`
        : token;
  }

  const res = await fetch(dataSource.endpointUrl, { headers, method: "GET" });
  if (!res.ok) {
    throw new Error(`Data source returned HTTP ${res.status}`);
  }
  const body = await res.json();
  return parseContactsPayload(body);
}
