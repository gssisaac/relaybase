import { describe, expect, it } from "node:test";

import { enhancePreviewHtml, isEmptyParagraphBlock } from "./editor-markdown";

describe("isEmptyParagraphBlock", () => {
  it("detects empty and nbsp-only paragraphs", () => {
    expect(isEmptyParagraphBlock({ type: "paragraph", content: [] })).toBe(true);
    expect(isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: " " }] })).toBe(
      true,
    );
    expect(
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: "\u00a0" }] }),
    ).toBe(true);
    expect(
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: "hello" }] }),
    ).toBe(false);
  });
});

describe("enhancePreviewHtml", () => {
  it("fills empty paragraphs for preview", () => {
    expect(enhancePreviewHtml("<p></p><p>Hi</p>")).toBe("<p>&nbsp;</p><p>Hi</p>");
  });
});
