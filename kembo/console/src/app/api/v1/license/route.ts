import { json } from "@/lib/license-admin";

export async function GET() {
  return json({ error: "Not found" }, 404);
}

export async function POST() {
  return json({ error: "Not found" }, 404);
}
