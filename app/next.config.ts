import path from "node:path";
import type { NextConfig } from "next";

const isDesktopBuild = process.env.DESKTOP_BUILD === "1";
// Monorepo root (pnpm-workspace.yaml). Turbopack must see this when
// `tauri dev` launches `pnpm --dir ../app next`, or it mis-infers the root
// as `app/src/app` and fails to resolve `next/package.json`.
const appRoot = import.meta.dirname;

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Tauri webview loads via 127.0.0.1; allow HMR from that origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // `app/pnpm-lock.yaml` makes Next treat `app/` as the package root (dev + export).
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
  ...(isDesktopBuild
    ? {
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;

if (process.env.NODE_ENV !== "production" && !isDesktopBuild) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev();
}
