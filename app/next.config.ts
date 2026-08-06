import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev({
    // Needed so wrangler.jsonc `remote: true` KV bindings hit Cloudflare,
    // not the stale local miniflare copy under .wrangler/state.
    experimental: { remoteBindings: true },
  });
}
