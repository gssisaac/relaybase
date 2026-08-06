import fs from "node:fs";
import path from "node:path";

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD) this document was last updated. */
  date: string;
  markdown: string;
};

function legalDir(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "content", "legal");
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

export function getLegalDoc(slug: "privacy" | "terms"): LegalDoc | null {
  const filePath = path.join(legalDir(), `${slug}.md`);
  if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) return null;

  const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8");
  const { data, body } = parseFrontmatter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? new Date().toISOString().slice(0, 10),
    markdown: body,
  };
}

export function formatLegalDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
