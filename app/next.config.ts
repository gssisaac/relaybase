import path from "node:path";
import type { NextConfig } from "next";

const isDesktopBuild = process.env.DESKTOP_BUILD === "1";
// Workspace root (`pnpm-workspace.yaml` + hoisted `node_modules/next`).
// Turbopack otherwise treats `src/app` as the project dir and cannot
// resolve `next/package.json` from there.
const turbopackRoot = path.join(import.meta.dirname, "..");

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Tauri webview loads via 127.0.0.1; allow HMR from that origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: turbopackRoot,
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

if (process.env.NODE_ENV !== "production" && !isDesktopBuild) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev();
}
