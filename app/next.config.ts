import path from "node:path";
import type { NextConfig } from "next";

const isDesktopBuild = process.env.DESKTOP_BUILD === "1";
// Monorepo root (pnpm-workspace.yaml). Turbopack must see this when
// `tauri dev` launches `pnpm --dir ../app next`, or it mis-infers the root
// as `app/src/app` and fails to resolve `next/package.json`.
const turbopackRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Tauri webview loads via 127.0.0.1; allow HMR from that origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: turbopackRoot,
  },
  ...(isDesktopBuild
    ? {
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
