/**
 * Copies desktop/public/release-notes/*.md into website/content/release-notes
 * so the static site can read them without reaching outside the package.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncMarkdownDir } from "./sync-copy-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(__dirname, "..");

syncMarkdownDir({
  sourceDir: path.resolve(
    websiteRoot,
    "..",
    "..",
    "desktop",
    "public",
    "release-notes",
  ),
  targetDir: path.join(websiteRoot, "content", "release-notes"),
  label: "sync-release-notes",
  includeFile: (entry) => /^\d+\.\d+\.\d+\.md$/i.test(entry),
});
