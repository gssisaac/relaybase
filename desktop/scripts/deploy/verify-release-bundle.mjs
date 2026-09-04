#!/usr/bin/env node
/**
 * Gate before sync/upload: bundled app version must match tauri.conf.json,
 * and the embedded static export must include required routes.
 *
 * Usage:
 *   node scripts/deploy/verify-release-bundle.mjs --app path/to/Relaybase.app
 *   node scripts/deploy/verify-release-bundle.mjs --tgz path/to/Relaybase.app.tar.gz
 *   node scripts/deploy/verify-release-bundle.mjs --app ... --tgz ...
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');

/** Routes that must exist in every desktop release (static export embedded in the binary). */
const REQUIRED_STATIC_MARKERS = ['/settings/update/index.html'];

function usage() {
  console.error(`Usage: verify-release-bundle.mjs --app <Relaybase.app> [--tgz <.tar.gz>]

Refuses to proceed when:
  - CFBundleShortVersionString does not match src-tauri/tauri.conf.json
  - the embedded static export is missing required routes

Do not rename or re-upload an old DMG/tar.gz under a new version filename.`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { app: null, tgz: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--app') {
      out.app = argv[++i];
    } else if (arg === '--tgz') {
      out.tgz = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
    }
  }
  if (!out.app && !out.tgz) usage();
  return out;
}

function readExpectedVersion() {
  const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  if (!conf.version || typeof conf.version !== 'string') {
    throw new Error(`Missing version in ${tauriConfPath}`);
  }
  return conf.version.trim();
}

function readBundleVersion(appDir) {
  const plist = path.join(appDir, 'Contents/Info.plist');
  if (!fs.existsSync(plist)) {
    throw new Error(`Missing Info.plist at ${plist}`);
  }
  const actual = execFileSync('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  }).trim();
  const build = execFileSync('plutil', ['-extract', 'CFBundleVersion', 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  }).trim();
  return { actual, build };
}

function readBinaryStrings(appDir) {
  const bin = path.join(appDir, 'Contents/MacOS/Relaybase');
  if (!fs.existsSync(bin)) {
    throw new Error(`Missing binary at ${bin}`);
  }
  return execFileSync('strings', [bin], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function verifyApp(appDir, expectedVersion) {
  const resolved = path.resolve(appDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`App bundle not found: ${resolved}`);
  }

  const { actual, build } = readBundleVersion(resolved);
  if (actual !== expectedVersion || build !== expectedVersion) {
    throw new Error(
      [
        `Bundle version mismatch for ${resolved}.`,
        `  CFBundleShortVersionString=${actual}`,
        `  CFBundleVersion=${build}`,
        `  tauri.conf.json=${expectedVersion}`,
        '',
        'Rebuild in this session: cd desktop && RELAYBASE_NOTARIZE=1 pnpm run build:macos',
        'Never rename, copy, or re-upload an older DMG/tar.gz under a new version filename.',
      ].join('\n'),
    );
  }

  const embedded = readBinaryStrings(resolved);
  const missing = REQUIRED_STATIC_MARKERS.filter((marker) => !embedded.includes(marker));
  if (missing.length > 0) {
    throw new Error(
      [
        `Bundle is missing embedded static routes (stale or incomplete build):`,
        ...missing.map((m) => `  - ${m}`),
        '',
        'Run a full desktop build after merging app changes, then verify again.',
      ].join('\n'),
    );
  }

  console.log(`[verify-release] OK Relaybase.app v${expectedVersion}`);
}

function extractAppFromTarGz(tgzPath, workDir) {
  const resolved = path.resolve(tgzPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Updater archive not found: ${resolved}`);
  }
  execFileSync('tar', ['-xzf', resolved, '-C', workDir], { stdio: 'inherit' });
  const app = path.join(workDir, 'Relaybase.app');
  if (!fs.existsSync(app)) {
    throw new Error(`No Relaybase.app inside ${resolved}`);
  }
  return app;
}

function main() {
  const { app, tgz } = parseArgs(process.argv.slice(2));
  const expectedVersion = readExpectedVersion();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relaybase-verify-'));

  try {
    if (app) {
      verifyApp(app, expectedVersion);
    }
    if (tgz) {
      const extracted = extractAppFromTarGz(tgz, workDir);
      verifyApp(extracted, expectedVersion);
    }
    console.log(`[verify-release] Bundle matches product version ${expectedVersion}`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[verify-release] ✗ ${message}`);
  process.exit(1);
}
