import nodeFs from "node:fs";
import path from "node:path";

import { FALLBACK_BRAND_LOGO_PNG } from "@lib/assets/fallback-brand-logo";
import { DEFAULT_BRAND_LOGO_FILENAME } from "@lib/templates/brand-logo-path";

let workerBrandLogoPng: Uint8Array | null = null;

export function primeWorkerBrandLogoPng(bytes: Uint8Array): void {
  workerBrandLogoPng = bytes;
}

export function readDefaultBrandLogoPng(): Uint8Array {
  if (workerBrandLogoPng) {
    return workerBrandLogoPng;
  }
  const filePath = path.join(process.cwd(), "public", "brand", DEFAULT_BRAND_LOGO_FILENAME);
  if (nodeFs.existsSync(filePath)) {
    return nodeFs.readFileSync(filePath);
  }
  return new Uint8Array(FALLBACK_BRAND_LOGO_PNG);
}
