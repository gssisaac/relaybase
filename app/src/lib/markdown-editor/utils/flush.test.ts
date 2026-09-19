import { describe, expect, it } from "vitest";

import {
  fingerprintEditorDocument,
  markdownFlushStrategy,
} from "./flush";

describe("fingerprintEditorDocument", () => {
  it("is stable for the same document", () => {
    const doc = [{ id: "a", type: "paragraph", content: [{ type: "text", text: "Hi" }] }];
    expect(fingerprintEditorDocument(doc)).toBe(fingerprintEditorDocument(doc));
  });

  it("changes when text changes", () => {
    const before = [{ id: "a", type: "paragraph", content: [{ type: "text", text: "Hi" }] }];
    const after = [{ id: "a", type: "paragraph", content: [{ type: "text", text: "Hey" }] }];
    expect(fingerprintEditorDocument(before)).not.toBe(fingerprintEditorDocument(after));
  });
});

describe("markdownFlushStrategy", () => {
  const fp = fingerprintEditorDocument([{ id: "a", type: "paragraph", content: [] }]);

  it("keeps the persisted file when the body and properties are untouched", () => {
    expect(markdownFlushStrategy(fp, fp, false)).toBe("persisted");
  });

  it("rejoins properties onto the original body when only YAML changed", () => {
    expect(markdownFlushStrategy(fp, fp, true)).toBe("join-body");
  });

  it("serializes when BlockNote blocks differ from hydrate", () => {
    const next = fingerprintEditorDocument([
      { id: "a", type: "paragraph", content: [{ type: "text", text: "edited" }] },
    ]);
    expect(markdownFlushStrategy(fp, next, false)).toBe("serialize");
  });

  it("serializes after a body edit even if properties also changed", () => {
    const next = fingerprintEditorDocument([
      { id: "a", type: "paragraph", content: [{ type: "text", text: "edited" }] },
    ]);
    expect(markdownFlushStrategy(fp, next, true)).toBe("serialize");
  });

  it("serializes when hydrate never completed (null fingerprint)", () => {
    expect(markdownFlushStrategy(null, fp, false)).toBe("serialize");
  });
});
