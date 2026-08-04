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
  const kv = await getRelaybaseApiKv();
  if (kv) {
    const raw = await kv.get(productKvKey(serviceId, filename));
    if (raw) return JSON.parse(raw) as T;
    return null;
  }
  return readProductJsonFromFs<T>(serviceId, filename);
}

export async function writeProductJson<T>(
  serviceId: string,
  filename: string,
  data: T,
): Promise<string> {
  const kv = await getRelaybaseApiKv();
  if (kv) {
    await kv.put(
      productKvKey(serviceId, filename),
      `${JSON.stringify(data, null, 2)}\n`,
    );
    return productKvKey(serviceId, filename);
  }
  return writeProductJsonToFs(serviceId, filename, data);
}
