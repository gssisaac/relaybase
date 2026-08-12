import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root (pnpm-workspace.yaml). Turbopack must see this when
// `next` is resolved via the root pnpm store, or it mis-infers the root.
const turbopackRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev();
}
