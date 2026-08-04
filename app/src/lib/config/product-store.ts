import fs from "fs";
import path from "path";

import { getRelaybaseApiKv } from "@/lib/cloudflare/kv";

const DATA_ROOT = path.join(process.cwd(), "..", "data", "products");

function productKvKey(serviceId: string, filename: string): string {
  return `product:${serviceId}:${filename}`;
}

export function getProductDataDir(serviceId: string): string {
  return path.join(DATA_ROOT, serviceId);
}

export async function readProductJson<T>(
  serviceId: string,
  filename: string,
): Promise<T | null> {
  const kv = await getRelaybaseApiKv();
  if (kv) {
    const raw = await kv.get(productKvKey(serviceId, filename), "text");
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  }

  const file = path.join(getProductDataDir(serviceId), filename);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export async function writeProductJson<T>(
  serviceId: string,
  filename: string,
  data: T,
): Promise<string> {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const kv = await getRelaybaseApiKv();
  if (kv) {
    await kv.put(productKvKey(serviceId, filename), payload);
    return productKvKey(serviceId, filename);
  }

  const dir = path.join(getProductDataDir(serviceId));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, filename);
  fs.writeFileSync(file, payload, "utf8");
  return file;
}
