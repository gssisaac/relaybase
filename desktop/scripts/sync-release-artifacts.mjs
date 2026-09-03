import { fileURLToPath } from 'node:url';
/**
 * After `tauri build`, writes updater metadata under website/public/release:
 *   latest.json, Relaybase.<version>.<arch>.app.tar.gz.sig
 *
 * Large binaries (DMG + .app.tar.gz) stay in the Tauri bundle and upload to R2
 * via upload-release-r2.sh — they are gitignored and must not be copied here.
 *
 * Env:
 *   RELAYBASE_MAC_ARCH — aarch64 (default) | x86_64
 *   DOWNLOAD_BASE_URL — base URL for metadata (default: https://relaybase.xyz/release)
 *   DOWNLOAD_CDN_BASE_URL — CDN for binaries (default: https://download.relaybase.xyz)
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolveDownloadCdnBaseUrl, resolveReleaseBaseUrl } from './lib/release-base-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const websiteRelease = path.join(root, '..', 'hq', 'website', 'public', 'release');
const cargoTarget = process.env.CARGO_TARGET_DIR
  ? path.resolve(process.env.CARGO_TARGET_DIR)
  : path.join(root, 'src-tauri', 'target');

function normalizeArch(raw) {
  const v = String(raw || 'aarch64').toLowerCase();
  if (v === 'aarch64' || v === 'arm64') {
    return { arch: 'aarch64', rustTarget: 'aarch64-apple-darwin', platformKey: 'darwin-aarch64' };
  }
  if (v === 'x86_64' || v === 'intel' || v === 'amd64') {
    return { arch: 'x86_64', rustTarget: 'x86_64-apple-darwin', platformKey: 'darwin-x86_64' };
  }
  console.error(`[sync-release] Unknown RELAYBASE_MAC_ARCH=${raw} (use aarch64 or x86_64)`);
  process.exit(1);
}

function readTauriConf() {
  return JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
}

function readExistingLatest(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Strip YAML frontmatter so updater / GitHub notes stay clean markdown. */
function stripFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return (match ? match[1] : normalized).trim();
}

function main() {
  const conf = readTauriConf();
  const version = conf.version;
  const { arch, rustTarget, platformKey } = normalizeArch(process.env.RELAYBASE_MAC_ARCH);
  resolveReleaseBaseUrl(root); // reserved for future metadata URL embedding
  const downloadBase = resolveDownloadCdnBaseUrl();

  const macosDir = path.join(cargoTarget, rustTarget, 'release', 'bundle', 'macos');

  fs.mkdirSync(websiteRelease, { recursive: true });
  const latestPath = path.join(websiteRelease, 'latest.json');
  const existing = readExistingLatest(latestPath);

  const notesPath = path.join(root, 'public', 'release-notes', `${version}.md`);
  if (!fs.existsSync(notesPath)) {
    console.error(`[sync-release] Missing ${notesPath}. Write kloy-style release notes before building.`);
    process.exit(1);
  }
  const releaseNotes = stripFrontmatter(fs.readFileSync(notesPath, 'utf8'));
  if (!releaseNotes) {
    console.error(`[sync-release] Release notes at ${notesPath} are empty.`);
    process.exit(1);
  }

  /** @type {{ version: string; notes: string; pub_date: string; platforms: Record<string, { url: string; signature: string }> }} */
  const manifest = {
    version,
    notes: releaseNotes,
    pub_date: new Date().toISOString(),
    platforms: {},
  };

  // Same version: keep sibling arch entries only when they already use
  // per-arch artifact URLs (*.aarch64.* / *.x86_64.*). Drop retired
  // darwin-universal and any leftover Universal-era platform rows.
  if (existing?.version === version && existing.platforms && typeof existing.platforms === 'object') {
    for (const [key, value] of Object.entries(existing.platforms)) {
      if (key === 'darwin-universal') continue;
      if (!value || typeof value !== 'object') continue;
      const url = typeof value.url === 'string' ? value.url : '';
      if (!url.includes('.aarch64.') && !url.includes('.x86_64.')) continue;
      manifest.platforms[key] = value;
    }
  }

  let addedUpdaterPlatforms = 0;
  const brandedArchive = `Relaybase.${version}.${arch}.app.tar.gz`;
  const brandedSig = `${brandedArchive}.sig`;

  if (fs.existsSync(macosDir)) {
    const files = fs.readdirSync(macosDir);
    const tgz = files.filter((f) => f.endsWith('.app.tar.gz') && !f.endsWith('.sig'));
    if (tgz.length === 0) {
      console.warn('[sync-release] No .app.tar.gz in bundle/macos. No new darwin updater entries this run.');
    } else {
      const archive = tgz[0];
      const sigName = `${archive}.sig`;
      const sigPath = path.join(macosDir, sigName);
      if (!fs.existsSync(sigPath)) {
        console.warn(`[sync-release] Missing signature for ${archive}, expected ${sigName}`);
      } else {
        fs.copyFileSync(sigPath, path.join(websiteRelease, brandedSig));
        const signature = fs.readFileSync(sigPath, 'utf8').trim();
        const entry = { url: `${downloadBase}/${encodeURIComponent(brandedArchive)}`, signature };
        manifest.platforms[platformKey] = entry;
        addedUpdaterPlatforms += 1;
        console.log(`[sync-release] Updater: ${platformKey} → ${downloadBase}/${brandedArchive}`);
      }
    }
  } else {
    console.warn(`[sync-release] No bundle/macos folder at ${macosDir}. Skipping updater bundle copy.`);
  }

  if (addedUpdaterPlatforms === 0) {
    if (!existing) {
      console.warn(
        '[sync-release] latest.json not created yet (need signed updater artifacts from tauri build with createUpdaterArtifacts).',
      );
    } else {
      console.log('[sync-release] No new updater bundles in this build; leaving latest.json unchanged.');
    }
    return;
  }

  fs.writeFileSync(latestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[sync-release] Wrote website/public/release/latest.json (version ${version}, arch ${arch})`);
}

main();
