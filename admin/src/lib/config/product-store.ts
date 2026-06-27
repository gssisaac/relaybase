import fs from "fs";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "..", "data", "products");

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

export function readProductJson<T>(
  serviceId: string,
  filename: string,
): T | null {
  const file = serviceDataFile(serviceId, filename);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as T;
}

export function writeProductJson<T>(
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
