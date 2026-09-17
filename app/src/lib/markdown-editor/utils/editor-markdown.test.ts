import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGmailContentLinkStyles,
  EMPTY_PARAGRAPH_MD,
  EMPTY_PARAGRAPH_PARSE_TOKEN,
  encodeEmptyParagraphsForParse,
  enhancePreviewHtml,
  isEmptyParagraphBlock,
  restoreEmptyParagraphBlocks,
} from "./editor-markdown.ts";

describe("isEmptyParagraphBlock", () => {
  it("detects empty and nbsp-only paragraphs", () => {
    assert.equal(isEmptyParagraphBlock({ type: "paragraph", content: [] }), true);
    assert.equal(
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: " " }] }),
      true,
    );
    assert.equal(
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: "\u00a0" }] }),
      true,
    );
    assert.equal(
      isEmptyParagraphBlock({
        type: "paragraph",
        content: [{ type: "text", text: EMPTY_PARAGRAPH_PARSE_TOKEN }],
      }),
      true,
    );
    assert.equal(
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: "hello" }] }),
      false,
    );
  });
});

describe("empty paragraph markdown round-trip", () => {
  it("does not treat NBSP sentinels as blank after JS trim", () => {
    assert.equal(EMPTY_PARAGRAPH_MD.trim(), "");
    assert.notEqual(EMPTY_PARAGRAPH_PARSE_TOKEN.trim(), "");
  });

  it("encodes persisted empty paragraphs so the markdown parser keeps them", () => {
    const saved = `a\n\n${EMPTY_PARAGRAPH_MD}\n\n${EMPTY_PARAGRAPH_MD}\n\nb\n`;
    assert.equal(
      encodeEmptyParagraphsForParse(saved),
      `a\n\n${EMPTY_PARAGRAPH_PARSE_TOKEN}\n\n${EMPTY_PARAGRAPH_PARSE_TOKEN}\n\nb\n`,
    );
  });

  it("leaves fenced code lines alone", () => {
    const markdown = "```\n\u00a0\n```\n";
    assert.equal(encodeEmptyParagraphsForParse(markdown), markdown);
  });

  it("restores parse-token paragraphs to empty blocks", () => {
    const restored = restoreEmptyParagraphBlocks([
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph", content: [{ type: "text", text: EMPTY_PARAGRAPH_PARSE_TOKEN }] },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ]);
    assert.deepEqual(restored, [
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph", content: [] },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ]);
  });
});

describe("enhancePreviewHtml", () => {
  it("fills empty paragraphs for preview", () => {
    assert.equal(enhancePreviewHtml("<p></p><p>Hi</p>"), "<p>&nbsp;</p><p>Hi</p>");
  });

  it("styles content links like Gmail", () => {
    assert.equal(
      enhancePreviewHtml('<p><a href="https://relaybase.com/docs">Guide</a></p>'),
      '<p><a href="https://relaybase.com/docs" style="color:#1155cc;text-decoration:underline;">Guide</a></p>',
    );
  });

  it("renders email button markers as bulletproof tables", () => {
    const marker =
      '<div data-rb-email-button="" data-text="Go" data-href="https://relaybase.com" data-variant="primary" data-align="center"></div>';
    const html = enhancePreviewHtml(marker);
    assert.match(html, /<table role="presentation"/);
    assert.match(html, /href="https:\/\/relaybase.com"/);
  });

  it("renders YouTube video tags as responsive email cards", () => {
    const video = '<video src="https://youtu.be/g87ErJB0rh4?list=RDg87ErJB0rh4" controls></video>';
    const html = enhancePreviewHtml(video);
    assert.match(html, /<table role="presentation"/);
    assert.match(html, /https:\/\/img\.youtube\.com\/vi\/g87ErJB0rh4\/hqdefault\.jpg/);
    assert.match(html, /https:\/\/www\.youtube\.com\/watch\?v=g87ErJB0rh4/);
  });
});

describe("applyGmailContentLinkStyles", () => {
  it("keeps explicit link colors (unsubscribe, buttons)", () => {
    const html =
      '<a href="/u" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>';
    assert.equal(applyGmailContentLinkStyles(html), html);
  });
});
