import fs from "fs";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "..", "data", "products");

export function getProductDataDir(serviceId: string): string {
  return path.join(DATA_ROOT, serviceId);
}

export function readProductJson<T>(
  serviceId: string,
  filename: string,
): T | null {
  const file = path.join(getProductDataDir(serviceId), filename);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeProductJson<T>(
  serviceId: string,
  filename: string,
  data: T,
): string {
  const dir = path.join(getProductDataDir(serviceId));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, filename);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}
