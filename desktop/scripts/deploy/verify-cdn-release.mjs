#!/usr/bin/env node
/**
 * After R2 upload, fetch the public CDN URL and refuse if bytes/version differ.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { tgz: null, version: null, cdnBase: 'https://download.relaybase.xyz' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tgz') out.tgz = argv[++i];
    else if (arg === '--version') out.version = argv[++i];
    else if (arg === '--cdn-base') out.cdnBase = argv[++i];
    else if (arg === '--help' || arg === '-h') usage();
    else usage(`Unknown argument: ${arg}`);
  }
  if (!out.tgz || !out.version) usage();
  return out;
}

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: verify-cdn-release.mjs --tgz <local.tgz> --version <semver> [--cdn-base URL]');
  process.exit(1);
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function readBundleVersion(appDir) {
  const plist = path.join(appDir, 'Contents/Info.plist');
  return execFileSync('plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plist], {
    encoding: 'utf8',
  }).trim();
}

function main() {
  const { tgz, version, cdnBase } = parseArgs(process.argv.slice(2));
  const localPath = path.resolve(tgz);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Local archive not found: ${localPath}`);
  }

  const fileName = path.basename(localPath);
  const localHash = sha256(localPath);
  const cdnUrl = `${cdnBase.replace(/\/$/, '')}/${encodeURIComponent(fileName)}`;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relaybase-cdn-verify-'));
  const downloaded = path.join(workDir, fileName);
  try {
    execFileSync('curl', ['-fsSL', '-H', 'Cache-Control: no-cache', '-o', downloaded, cdnUrl], {
      stdio: 'inherit',
    });

    const remoteHash = sha256(downloaded);
    if (remoteHash !== localHash) {
      throw new Error(
        [
          `CDN object mismatch for ${fileName}.`,
          `  local sha256=${localHash}`,
          `  cdn   sha256=${remoteHash}`,
          '',
          'Cloudflare may still be serving a poisoned immutable cache for this key.',
          'Bump the patch version and upload new filenames instead of overwriting.',
        ].join('\n'),
      );
    }

    execFileSync('tar', ['-xzf', downloaded, '-C', workDir], { stdio: 'inherit' });
    const appDir = path.join(workDir, 'Relaybase.app');
    const bundleVersion = readBundleVersion(appDir);
    if (bundleVersion !== version) {
      throw new Error(
        `CDN bundle version is ${bundleVersion}, expected ${version} (${cdnUrl}).`,
      );
    }

    console.log(`[verify-cdn] OK ${fileName} v${version} (${cdnUrl})`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[verify-cdn] ✗ ${message}`);
  process.exit(1);
}
