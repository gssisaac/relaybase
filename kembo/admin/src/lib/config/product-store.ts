import fs from "fs";
import path from "path";

import { eq, and } from "drizzle-orm";
import { productSettings } from "@/db/schema";
import { getDb } from "@/lib/cloudflare/kv";

const DATA_ROOT = path.join(process.cwd(), "..", "..", "data", "products");

export function getProductDataDir(serviceId: string): string {
  return path.join(DATA_ROOT, serviceId);
}

export function ensureServiceDataDir(serviceId: string): string {
  const dir = getProductDataDir(serviceId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function serviceDataFile(serviceId: string, filename: string): string {
  return path.join(getProductDataDir(serviceId), filename);
}

function readProductJsonFromFs<T>(
  serviceId: string,
  filename: string,
): T | null {
  const file = serviceDataFile(serviceId, filename);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as T;
}

function writeProductJsonToFs<T>(
  serviceId: string,
  filename: string,
  data: T,
): string {
  const dir = ensureServiceDataDir(serviceId);
  const file = path.join(dir, filename);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return file;
}

export async function readProductJson<T>(
  serviceId: string,
  filename: string,
): Promise<T | null> {
  const db = await getDb();
  if (db) {
    const row = await db
      .select()
      .from(productSettings)
      .where(
        and(
          eq(productSettings.serviceId, serviceId),
          eq(productSettings.filename, filename),
        ),
      )
      .get();
    if (!row) return null;
    return JSON.parse(row.data) as T;
  }
  return readProductJsonFromFs<T>(serviceId, filename);
}

export async function writeProductJson<T>(
  serviceId: string,
  filename: string,
  data: T,
): Promise<string> {
  const db = await getDb();
  if (db) {
    const now = new Date().toISOString();
    const jsonStr = `${JSON.stringify(data, null, 2)}\n`;
    const existing = await db
      .select()
      .from(productSettings)
      .where(
        and(
          eq(productSettings.serviceId, serviceId),
          eq(productSettings.filename, filename),
        ),
      )
      .get();
    if (existing) {
      await db
        .update(productSettings)
        .set({ data: jsonStr, updatedAt: now })
        .where(
          and(
            eq(productSettings.serviceId, serviceId),
            eq(productSettings.filename, filename),
          ),
        );
    } else {
      await db.insert(productSettings).values({
        serviceId,
        filename,
        data: jsonStr,
        updatedAt: now,
      });
    }
    return `product_settings:${serviceId}:${filename}`;
  }
  return writeProductJsonToFs(serviceId, filename, data);
}
