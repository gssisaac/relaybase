import fs from "node:fs";
import path from "node:path";

const VERSION_FILE_PATTERN = /^(\d+\.\d+\.\d+)\.md$/i;

export type ReleaseNoteSection = {
  title: string;
  items: string[];
};

export type ReleaseNote = {
  version: string;
  title: string;
  /** ISO date (YYYY-MM-DD) the version was released. */
  date: string;
  sections: ReleaseNoteSection[];
  markdown: string;
};

function compareSemver(a: string, b: string) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const left = partsA[index] ?? 0;
    const right = partsB[index] ?? 0;
    if (left !== right) return left - right;
  }

  return 0;
}

/** Synced from desktop/public/release-notes by scripts/sync-release-notes.mjs */
function releaseNotesDir(): string {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "content",
    "release-notes",
  );
}

function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: normalized.trim() };

  const [, frontmatter, body] = match;
  const data: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
    data[key] = value;
  }

  return { data, body: body.trim() };
}

function parseReleaseNote(
  version: string,
  markdown: string,
  fallbackDate: string,
): ReleaseNote {
  const { data, body } = parseFrontmatter(markdown);
  const lines = body.split("\n");
  let title = `Relaybase ${version}`;
  const sections: ReleaseNoteSection[] = [];
  let current: ReleaseNoteSection | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading1 = line.match(/^#\s+(.+)$/);
    if (heading1) {
      title = heading1[1].trim();
      continue;
    }

    const heading2 = line.match(/^##\s+(.+)$/);
    if (heading2) {
      current = { title: heading2[1].trim(), items: [] };
      sections.push(current);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet && current) {
      current.items.push(bullet[1].trim());
    }
  }

  return {
    version,
    title,
    date: data.date ?? fallbackDate,
    sections: sections.filter((section) => section.items.length > 0),
    markdown: body,
  };
}

export function getAllReleaseNotes(): ReleaseNote[] {
  const dir = releaseNotesDir();
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) return [];

  const notes: ReleaseNote[] = [];

  for (const fileName of fs.readdirSync(/* turbopackIgnore: true */ dir)) {
    const match = fileName.match(VERSION_FILE_PATTERN);
    if (!match) continue;

    const version = match[1];
    const filePath = path.join(dir, fileName);
    const markdown = fs.readFileSync(
      /* turbopackIgnore: true */ filePath,
      "utf8",
    );
    const fallbackDate = fs
      .statSync(/* turbopackIgnore: true */ filePath)
      .mtime.toISOString()
      .slice(0, 10);
    notes.push(parseReleaseNote(version, markdown, fallbackDate));
  }

  return notes.sort((a, b) => compareSemver(b.version, a.version));
}

export function getReleaseNote(version: string): ReleaseNote | null {
  return getAllReleaseNotes().find((note) => note.version === version) ?? null;
}

export function getReleaseNoteVersions(): string[] {
  return getAllReleaseNotes().map((note) => note.version);
}

export function formatReleaseDate(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
