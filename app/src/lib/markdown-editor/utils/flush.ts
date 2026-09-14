/**
 * Decide whether a BlockNote snapshot should replace the persisted markdown.
 *
 * `blocksToMarkdownLossy` is not an identity transform. Flushing on every
 * interval / unmount / source-view toggle would mark an unedited file dirty
 * and rewrite it. Compare the hydrated document fingerprint to the current
 * one so swallowed BlockNote `onChange` events still persist, while a
 * no-op round-trip does not.
 */

export function fingerprintEditorDocument(document: unknown): string {
  return JSON.stringify(document);
}

export type MarkdownFlushStrategy = "persisted" | "join-body" | "serialize";

export function markdownFlushStrategy(
  hydratedFingerprint: string | null,
  currentFingerprint: string,
  propertiesEdited: boolean,
): MarkdownFlushStrategy {
  const bodyUnchanged =
    hydratedFingerprint != null && hydratedFingerprint === currentFingerprint;
  if (bodyUnchanged && !propertiesEdited) return "persisted";
  if (bodyUnchanged) return "join-body";
  return "serialize";
}
