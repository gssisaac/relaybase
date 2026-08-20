import { verifyLicense } from "@/lib/licenses";
import { getDb } from "@/db/client";
import { getEnv } from "@/lib/env";
import { json } from "@/lib/license-admin";

/** Public: activate / offline-check from the desktop app. */
export async function POST(req: Request) {
  const env = await getEnv();
  let body: { licenseKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const key = body.licenseKey?.trim();
  if (!key) return json({ ok: false, error: "licenseKey required" }, 400);
  const record = await verifyLicense(getDb(env), key);
  if (!record) return json({ ok: false, error: "Invalid or revoked license" }, 404);
  return json({
    ok: true,
    email: record.email,
    createdAt: record.createdAt,
    tier: record.tier,
    status: record.status,
    currentPeriodEnd: record.currentPeriodEnd,
  });
}
