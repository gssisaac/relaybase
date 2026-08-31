import { fileURLToPath } from 'node:url';
/**
 * After `tauri build`, copies macOS installers into website/public/release and
 * writes/merges `latest.json` for the Tauri in-app updater.
 *
 * Env:
 *   DOWNLOAD_BASE_URL — base URL for metadata (default: https://relaybase.xyz/release)
 *   DOWNLOAD_CDN_BASE_URL — CDN for binaries (default: https://download.relaybase.xyz)
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolveDownloadCdnBaseUrl, resolveReleaseBaseUrl } from './lib/release-base-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const websiteRelease = path.join(root, '..', '..', 'hq', 'website', 'public', 'release');
const cargoTarget = process.env.CARGO_TARGET_DIR
  ? path.resolve(process.env.CARGO_TARGET_DIR)
  : path.join(root, 'src-tauri', 'target');
const dmgDir = path.join(cargoTarget, 'universal-apple-darwin', 'release', 'bundle', 'dmg');
const macosDir = path.join(cargoTarget, 'universal-apple-darwin', 'release', 'bundle', 'macos');

function readTauriConf() {
  return JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
}

function inferDarwinPlatforms(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('universal')) {
    return ['darwin-universal', 'darwin-aarch64', 'darwin-x86_64'];
  }
  if (lower.includes('aarch64') || lower.includes('arm64')) return ['darwin-aarch64'];
  if (lower.includes('x86_64') || lower.includes('amd64')) return ['darwin-x86_64'];
  return ['darwin-universal', 'darwin-aarch64', 'darwin-x86_64'];
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
  resolveReleaseBaseUrl(root); // reserved for future metadata URL embedding
  const downloadBase = resolveDownloadCdnBaseUrl();

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
    platforms: { ...(existing?.platforms && typeof existing.platforms === 'object' ? existing.platforms : {}) },
  };

  let addedUpdaterPlatforms = 0;

  if (fs.existsSync(dmgDir)) {
    const dmgs = fs.readdirSync(dmgDir).filter((f) => f.endsWith('.dmg'));
    for (const f of dmgs) {
      const from = path.join(dmgDir, f);
      const branded = `Relaybase.${version}.dmg`;
      const to = path.join(websiteRelease, branded);
      fs.copyFileSync(from, to);
      console.log(`[sync-release] Copied DMG → website/public/release/${branded}`);
    }
    if (dmgs.length === 0) {
      console.warn('[sync-release] No .dmg files in bundle/dmg.');
    }
  } else {
    console.warn('[sync-release] No bundle/dmg folder. Skipping DMG copy.');
  }

  if (fs.existsSync(macosDir)) {
    const files = fs.readdirSync(macosDir);
    const tgz = files.filter((f) => f.endsWith('.app.tar.gz') && !f.endsWith('.sig'));
    for (const archive of tgz) {
      const sigName = `${archive}.sig`;
      const sigPath = path.join(macosDir, sigName);
      if (!fs.existsSync(sigPath)) {
        console.warn(`[sync-release] Missing signature for ${archive}, expected ${sigName}`);
        continue;
      }
      const versionedArchive = `Relaybase.${version}.app.tar.gz`;
      const versionedSig = `${versionedArchive}.sig`;
      fs.copyFileSync(path.join(macosDir, archive), path.join(websiteRelease, versionedArchive));
      fs.copyFileSync(sigPath, path.join(websiteRelease, versionedSig));
      const signature = fs.readFileSync(sigPath, 'utf8').trim();
      const entry = { url: `${downloadBase}/${encodeURIComponent(versionedArchive)}`, signature };
      for (const key of inferDarwinPlatforms(archive)) {
        manifest.platforms[key] = entry;
        addedUpdaterPlatforms += 1;
        console.log(`[sync-release] Updater: ${key} → ${downloadBase}/${versionedArchive}`);
      }
    }
    if (tgz.length === 0) {
      console.warn('[sync-release] No .app.tar.gz in bundle/macos. No new darwin updater entries this run.');
    }
  } else {
    console.warn('[sync-release] No bundle/macos folder. Skipping updater bundle copy.');
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
  console.log(`[sync-release] Wrote website/public/release/latest.json (version ${version})`);
}

main();
