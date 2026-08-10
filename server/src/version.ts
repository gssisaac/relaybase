/**
 * Worker build version. The customer install ZIP is stamped with the
 * `server/package.json` version by `pack-customer-install.mjs`, so the value
 * reported by `GET /admin/version` matches `worker-manifest.json` bundled in
 * the desktop app. Bump `server/package.json` `version` on releases.
 */
export const WORKER_VERSION = "0.1.0";
