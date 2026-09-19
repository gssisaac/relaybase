import type { ComposeMergeTag, ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";
import { composeBroadcastMergeTagSections } from "@/studio/lib/layouts/compose-merge-tag-sections";

export type MergeTagSlashMenuEntry = {
  token: string;
  title: string;
  subtext: string;
  group: string;
  aliases: string[];
};

export function buildMergeTagAliases(tag: ComposeMergeTag): string[] {
  const token = tag.token;
  const innerToken = token.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
  const parts = innerToken.split(/[._-]/).filter(Boolean);
  const labelWords = tag.label.toLowerCase().split(/\s+/).filter(Boolean);
  const aliases = new Set<string>([
    token,
    innerToken,
    tag.id,
    tag.label.toLowerCase(),
    ...parts,
    ...labelWords,
  ]);
  if (tag.description) {
    const descWords = tag.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (const w of descWords.slice(0, 5)) {
      aliases.add(w);
    }
  }
  if (innerToken.includes("organization")) {
    aliases.add("org");
  }
  return Array.from(aliases);
}

export function mergeTagSlashMenuEntries(
  sections?: ComposeMergeTagSection[],
): MergeTagSlashMenuEntry[] {
  const activeSections =
    sections && sections.length > 0
      ? sections
      : composeBroadcastMergeTagSections(null);

  const entries: MergeTagSlashMenuEntry[] = [];
  for (const section of activeSections) {
    for (const tag of section.tags) {
      entries.push({
        token: tag.token,
        title: tag.token,
        subtext: tag.label,
        group: section.title,
        aliases: buildMergeTagAliases(tag),
      });
    }
  }
  return entries;
}
