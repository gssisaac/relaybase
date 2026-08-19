import fs from "node:fs";
import path from "node:path";

export type Resource = {
  slug: string;
  title: string;
  navTitle: string;
  description: string;
  keyword?: string;
  order: number;
  image?: string;
  imageAlt?: string;
  /** ISO date (YYYY-MM-DD) the resource was first published. */
  date: string;
  /** ISO date (YYYY-MM-DD) the resource content was last updated, if different from `date`. */
  updated?: string;
  markdown: string;
};

function resourcesDir(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "content", "resources");
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

function slugFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/i, "");
}

export function getAllResources(): Resource[] {
  const dir = resourcesDir();
  if (!fs.existsSync(/* turbopackIgnore: true */ dir)) return [];

  const resources: Resource[] = [];

  for (const fileName of fs.readdirSync(/* turbopackIgnore: true */ dir)) {
    if (!fileName.endsWith(".md")) continue;

    const filePath = path.join(dir, fileName);
    const raw = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const slug = slugFromFileName(fileName);

    const title = data.title ?? slug;
    // Fall back to file mtime if frontmatter omits `date` so every resource
    // always has a real publish date for Article schema and the sitemap.
    const fallbackDate = fs
      .statSync(/* turbopackIgnore: true */ filePath)
      .mtime.toISOString()
      .slice(0, 10);

    resources.push({
      slug,
      title,
      navTitle: data.navTitle ?? title,
      description: data.description ?? "",
      keyword: data.keyword,
      order: Number(data.order ?? 999),
      image: data.image,
      imageAlt: data.imageAlt ?? title,
      date: data.date ?? fallbackDate,
      updated: data.updated,
      markdown: body,
    });
  }

  return resources.sort((a, b) => a.order - b.order);
}

export function getResource(slug: string): Resource | null {
  return getAllResources().find((resource) => resource.slug === slug) ?? null;
}

export function getResourceSlugs(): string[] {
  return getAllResources().map((resource) => resource.slug);
}
