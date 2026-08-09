import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root (pnpm-workspace.yaml). Turbopack must see this when
// `next` is resolved via the root pnpm store, or it mis-infers the root
// as `website/src/app` and fails to resolve `next/package.json`.
const turbopackRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
