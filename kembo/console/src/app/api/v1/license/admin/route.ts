import { createLicense, listLicenses } from "@/lib/licenses";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";
import { isLicenseAdmin, json } from "@/lib/license-admin";

export async function GET(req: Request) {
  const env = await getEnv();
  if (!(await isLicenseAdmin(req, env))) return json({ error: "Unauthorized" }, 401);
  const licenses = await listLicenses(getDb(env));
  return json({ licenses });
}

export async function POST(req: Request) {
  const env = await getEnv();
  if (!(await isLicenseAdmin(req, env))) return json({ error: "Unauthorized" }, 401);

  let body: { email?: string; note?: string; tier?: "free" | "pro" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.email?.trim()) return json({ error: "email required" }, 400);
  const { record, licenseKey } = await createLicense(getDb(env), {
    email: body.email,
    tier: body.tier ?? "pro",
    note: body.note ?? "manual",
  });
  return json({ record, licenseKey });
}
