import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emailButtonMarkerHtml,
  renderBulletproofEmailButton,
  transformEmailButtonMarkersToBulletproof,
} from "./email-button-html.ts";
import { promoteEmailButtonBlocks, serializeEmailButtonBlockMarkdown } from "./email-button-markdown.ts";

describe("emailButtonMarkerHtml", () => {
  it("serializes props to a stable marker div", () => {
    const marker = emailButtonMarkerHtml({
      text: "Read more",
      url: "https://example.com/path?q=1",
      variant: "outline",
      alignment: "center",
    });
    assert.match(marker, /data-rb-email-button/);
    assert.match(marker, /data-text="Read more"/);
    assert.match(marker, /data-href="https:\/\/example.com\/path\?q=1"/);
  });
});

describe("transformEmailButtonMarkersToBulletproof", () => {
  it("replaces marker divs with table-based buttons", () => {
    const marker = emailButtonMarkerHtml({
      text: "Go",
      url: "https://relaybase.com",
      variant: "primary",
      alignment: "center",
    });
    const html = transformEmailButtonMarkersToBulletproof(`<p>Hi</p>${marker}`);
    assert.match(html, /<table role="presentation"/);
    assert.match(html, /href="https:\/\/relaybase.com"/);
    assert.match(html, /Go/);
    assert.doesNotMatch(html, /\bdata-rb-email-button=""/);
  });
});

describe("renderBulletproofEmailButton", () => {
  it("sets explicit link color so Gmail styling skips it", () => {
    const html = renderBulletproofEmailButton({
      text: "CTA",
      url: "https://x.test",
      variant: "primary",
      alignment: "full",
    });
    assert.match(html, /color:#ffffff/);
    assert.match(html, /display:block/);
  });

  it("wraps centered buttons in a full-width row for preview layout", () => {
    const html = renderBulletproofEmailButton({
      text: "Go",
      url: "https://relaybase.com",
      variant: "primary",
      alignment: "center",
    });
    assert.match(html, /data-rb-email-button-row/);
    assert.match(html, /text-align:center/);
    assert.match(html, /align="center"/);
  });

  it("supports right alignment in bulletproof output", () => {
    const html = renderBulletproofEmailButton({
      text: "Go",
      url: "https://relaybase.com",
      variant: "primary",
      alignment: "right",
    });
    assert.match(html, /text-align:right/);
    assert.match(html, /align="right"/);
  });
});

describe("promoteEmailButtonBlocks", () => {
  it("promotes a paragraph containing a marker to an emailButton block", () => {
    const marker = emailButtonMarkerHtml({
      text: "Subscribe",
      url: "https://x.test/sub",
      variant: "outline",
      alignment: "left",
    });
    const [block] = promoteEmailButtonBlocks([
      {
        type: "paragraph",
        content: [{ type: "text", text: marker }],
        children: [],
      },
    ]);
    assert.equal(serializeEmailButtonBlockMarkdown(block), marker);
    assert.match(serializeEmailButtonBlockMarkdown(block)!, /data-align="left"/);
  });
});
