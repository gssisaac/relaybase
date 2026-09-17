import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyGmailContentLinkStyles,
  enhancePreviewHtml,
  isEmptyParagraphBlock,
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
      isEmptyParagraphBlock({ type: "paragraph", content: [{ type: "text", text: "hello" }] }),
      false,
    );
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
});

describe("applyGmailContentLinkStyles", () => {
  it("keeps explicit link colors (unsubscribe, buttons)", () => {
    const html =
      '<a href="/u" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>';
    assert.equal(applyGmailContentLinkStyles(html), html);
  });
});
