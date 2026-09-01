import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function fileHash(filePath) {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

/** Copy only when missing or content differs. Avoids mtime churn that triggers Next file watchers. */
export function syncMarkdownDir({
  sourceDir,
  targetDir,
  label,
  includeFile,
}) {
  if (!fs.existsSync(sourceDir)) {
    console.error(`[${label}] Missing source: ${sourceDir}`);
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const wanted = new Set();
  let copied = 0;
  let skipped = 0;

  for (const entry of fs.readdirSync(sourceDir)) {
    if (!includeFile(entry)) continue;
    wanted.add(entry);
    const src = path.join(sourceDir, entry);
    const dest = path.join(targetDir, entry);
    if (fs.existsSync(dest) && fileHash(src) === fileHash(dest)) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(src, dest);
    copied += 1;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(targetDir)) {
    if (!entry.endsWith(".md")) continue;
    if (wanted.has(entry)) continue;
    fs.unlinkSync(path.join(targetDir, entry));
    removed += 1;
  }

  console.log(
    `[${label}] synced ${wanted.size} file(s) → ${path.relative(process.cwd(), targetDir)}` +
      ` (copied ${copied}, unchanged ${skipped}, removed ${removed})`,
  );
}
