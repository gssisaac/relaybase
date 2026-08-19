import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE = 'https://relaybase.xyz/release';
const DEFAULT_DOWNLOAD_CDN_BASE = 'https://download.relaybase.xyz';

/**
 * Public base URL for large binary downloads (DMG, updater .app.tar.gz).
 * Served from the R2 custom domain (real CDN edge caching), separate from
 * the small metadata (latest.json, artifacts.json) which stays on the
 * website Worker/assets at relaybase.xyz/release.
 *
 * Resolution order:
 * 1. DOWNLOAD_CDN_BASE_URL env
 * 2. DEFAULT_DOWNLOAD_CDN_BASE (https://download.relaybase.xyz)
 */
export function resolveDownloadCdnBaseUrl(env = process.env) {
  const fromEnv = env.DOWNLOAD_CDN_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_DOWNLOAD_CDN_BASE;
}

/**
 * Public base URL for release metadata (latest.json, .sig).
 *
 * Resolution order:
 * 1. DOWNLOAD_BASE_URL env
 * 2. website/cloudflare/config.json `domain`
 * 3. DEFAULT_BASE
 */
export function resolveReleaseBaseUrl(root, env = process.env) {
  const fromEnv = env.DOWNLOAD_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const cloudflareConfig = path.join(root, '..', '..', 'kembo', 'website', 'cloudflare', 'config.json');
  if (fs.existsSync(cloudflareConfig)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cloudflareConfig, 'utf8'));
      const domain = typeof cfg.domain === 'string' ? cfg.domain.trim() : '';
      if (domain) {
        const base = domain.startsWith('http') ? domain : `https://${domain}`;
        return `${base.replace(/\/$/, '')}/release`;
      }
    } catch {
      /* fall through */
    }
  }

  return DEFAULT_BASE;
}

export function resolveUpdaterManifestUrl(root, env = process.env) {
  return `${resolveReleaseBaseUrl(root, env)}/latest.json`;
}
